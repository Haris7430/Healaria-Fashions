
const User= require('../../models/userSchema');
const mongoose= require('mongoose');
const bcrypt= require('bcrypt');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');


const loadLogin= (req,res)=>{
    if(req.session.isAdmin){
        return res.redirect('/admin/admin-dashboard');
    }
    res.render('admin-login',{error:null})
}


const login = async(req, res) => {
    try {
        const {email, password} = req.body;
        const admin = await User.findOne({email, isAdmin: true});
        if(admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            
            if(passwordMatch) {
                req.session.isAdmin = true;
                
                return res.redirect('/admin/admin-dashboard') 
            } else {
                console.log('admin password not match');
                return res.render('admin-login', { error: 'Invalid credentials' });
            }
        } else {
            console.log('user not admin');
            return res.render('admin-login', { error: 'Invalid credentials' });
        }
    } catch(error) {
        console.log('login error', error);
        return res.redirect('/admin/pageerror');
    }
}


const loadDashboard = async (req, res) => {
    if (req.session.isAdmin) {
        try {
            // Fetch admin user data
            const adminUser = await User.findOne({ isAdmin: true });
            res.render('admin-dashboard', { admin: adminUser });
        } catch (error) {
            res.redirect('/pageerror');
        }
    }
};


const constructPreviousPeriodQuery = (range, startDate, endDate) => {
    const now = new Date();
    let query = {};

    switch (range) {
        case 'daily':
            const yesterdayStart = new Date(now);
            yesterdayStart.setDate(yesterdayStart.getDate() - 1);
            query = {
                createdAt: {
                    $gte: new Date(yesterdayStart.setHours(0, 0, 0, 0)),
                    $lt: new Date(yesterdayStart.setHours(23, 59, 59, 999))
                }
            };
            break;
        case 'weekly':
            const twoWeeksAgo = new Date(now);
            const oneWeekAgo = new Date(now);
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            query = {
                createdAt: {
                    $gte: twoWeeksAgo,
                    $lt: oneWeekAgo
                }
            };
            break;
        // Similar patterns for monthly and yearly...
        case 'custom':
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const duration = end - start;
                const previousStart = new Date(start);
                previousStart.setTime(previousStart.getTime() - duration);
                const previousEnd = new Date(start);
                query = {
                    createdAt: {
                        $gte: previousStart,
                        $lt: previousEnd
                    }
                };
            }
            break;
    }
    return query;
};


function calculatePeriodMetrics(orders) {
    return orders.reduce((acc, order) => {
        acc.revenue += order.total;
        acc.discounts += (order.totalDiscount || 0) + 
                        (order.couponApplied?.discountAmount || 0);
        return acc;
    }, { revenue: 0, discounts: 0 });
}

const getDashboardData = async (req, res) => {
    try {
        const { range = 'monthly', startDate, endDate } = req.query;
        const dateQuery = constructDateQuery(range, startDate, endDate);
        const previousDateQuery = constructPreviousPeriodQuery(range, startDate, endDate);

        // Get orders for both periods
        const [currentPeriodOrders, previousPeriodOrders] = await Promise.all([
            Order.find({
                ...dateQuery,
                status: { $ne: 'cancelled' }
            }),
            Order.find({
                ...previousDateQuery,
                status: { $ne: 'cancelled' }
            })
        ]);

        // Calculate metrics including discounts
        const currentMetrics = calculatePeriodMetrics(currentPeriodOrders);
        const previousMetrics = calculatePeriodMetrics(previousPeriodOrders);
        
        // Get top products with proper aggregation
        const topProducts = await Order.aggregate([
            { 
                $match: { 
                    ...dateQuery, 
                    status: { $ne: 'cancelled' } 
                } 
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productId',
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: '$items.totalPrice' }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $project: {
                    name: '$productDetails.productName',
                    quantity: '$totalQuantity',
                    revenue: '$totalRevenue'
                }
            }
        ]);

        // Get top categories
        const topCategories = await Order.aggregate([
            { 
                $match: { 
                    ...dateQuery, 
                    status: { $ne: 'cancelled' } 
                } 
            },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'product.category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            {
                $group: {
                    _id: '$category._id',
                    name: { $first: '$category.name' },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: '$items.totalPrice' }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 }
        ]);

        // Calculate growth rates
        const calculateGrowth = (current, previous) => {
            if (!previous || previous === 0) return 0;
            return ((current - previous) / previous) * 100;
        };

        res.json({
            totalRevenue: currentMetrics.revenue,
            totalOrders: currentPeriodOrders.length,
            totalCustomers: await User.countDocuments({ ...dateQuery, isAdmin: false }),
            totalDiscounts: currentMetrics.discounts,
            revenueGrowth: calculateGrowth(currentMetrics.revenue, previousMetrics.revenue),
            orderGrowth: calculateGrowth(currentPeriodOrders.length, previousPeriodOrders.length),
            customerGrowth: calculateGrowth(
                await User.countDocuments({ ...dateQuery, isAdmin: false }),
                await User.countDocuments({ ...previousDateQuery, isAdmin: false })
            ),
            discountGrowth: calculateGrowth(currentMetrics.discounts, previousMetrics.discounts),
            topProducts,
            topCategories
        });

    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};



// Add these helper functions at the top of adminController.js

const constructDateQuery = (range, startDate, endDate) => {
    const now = new Date();
    let query = {};

    switch (range) {
        case 'daily':
            query = {
                createdAt: {
                    $gte: new Date(now.setHours(0, 0, 0, 0)),
                    $lt: new Date(now.setHours(23, 59, 59, 999))
                }
            };
            break;
        case 'weekly':
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = { createdAt: { $gte: weekAgo } };
            break;
        case 'monthly':
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            query = { createdAt: { $gte: monthAgo } };
            break;
        case 'yearly':
            const yearAgo = new Date(now);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            query = { createdAt: { $gte: yearAgo } };
            break;
        case 'custom':
            if (startDate && endDate) {
                query = {
                    createdAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                    }
                };
            }
            break;
    }
    return query;
};

const getSalesReportData = async (range, startDate, endDate, page = 1, limit = 10) => {
    const dateQuery = constructDateQuery(range, startDate, endDate);
    const skip = (page - 1) * limit;
    
    const data = await Order.aggregate([
        { 
            $match: { 
                ...dateQuery,
                status: { $ne: 'cancelled' } 
            } 
        },
        {
            $group: {
                _id: { 
                    $dateToString: { 
                        format: "%Y-%m-%d",
                        date: "$createdAt"
                    } 
                },
                totalSales: { $sum: '$total' },
                ordersCount: { $sum: 1 },
                productDiscounts: { $sum: '$totalDiscount' },
                couponDiscounts: { $sum: { $ifNull: ['$couponApplied.discountAmount', 0] } },
                netSales: {
                    $sum: {
                        $subtract: [
                            '$total',
                            {
                                $add: [
                                    '$totalDiscount',
                                    { $ifNull: ['$couponApplied.discountAmount', 0] }
                                ]
                            }
                        ]
                    }
                }
            }
        },
        { $sort: { _id: -1 } },
        {
            $facet: {
                metadata: [{ $count: "total" }],
                data: [{ $skip: skip }, { $limit: limit }]
            }
        }
    ]);

    const totalRecords = data[0].metadata[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);
    
    return {
        data: data[0].data,
        pagination: {
            currentPage: page,
            totalPages,
            totalRecords,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
};

// Update the existing getSalesReport function
const getSalesReport = async (req, res) => {
    try {
        const { range, startDate, endDate, page = 1 } = req.query;
        
        // Validate custom date range
        if (range === 'custom') {
            const today = new Date();
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (start > today) {
                return res.status(400).json({ 
                    error: 'Start date cannot be in the future' 
                });
            }
            
            if (end < start) {
                return res.status(400).json({ 
                    error: 'End date must be after start date' 
                });
            }
        }

        const result = await getSalesReportData(range, startDate, endDate, parseInt(page));
        res.json(result);

    } catch (error) {
        console.error('Sales report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update the downloadReport function
const downloadReport = async (req, res) => {
    try {
        const { format } = req.params;
        const { range, startDate, endDate } = req.query;
        
        // Validate custom date range
        if (range === 'custom') {
            const today = new Date();
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (start > today || end < start) {
                return res.status(400).json({ 
                    error: 'Invalid date range' 
                });
            }
        }

        // Get all data without pagination for download
        const { data } = await getSalesReportData(range, startDate, endDate, 1, Number.MAX_SAFE_INTEGER);

        // Calculate totals for the last row
        const totals = data.reduce((acc, row) => {
            acc.orders += row.ordersCount;
            acc.totalSales += row.totalSales;
            acc.discounts += (row.productDiscounts + row.couponDiscounts);
            acc.netSales += row.netSales;
            return acc;
        }, { orders: 0, totalSales: 0, discounts: 0, netSales: 0 });

        if (format === 'pdf') {
            const doc = new PDFDocument({
                margin: 30,
                size: 'A4'
            });
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
            
            doc.pipe(res);

            // Add title
            doc.font('Helvetica-Bold')
               .fontSize(16)
               .text('Sales Report', { align: 'center' });
            doc.moveDown(2);

            // Define table layout
            const tableLayout = {
                // Increased width to accommodate numbers better
                columnSpacing: 5,
                columns: [
                    { id: 'date', header: 'Date', width: 90 },
                    { id: 'orders', header: 'Orders', width: 70, align: 'right' },
                    { id: 'sales', header: 'Total Sales', width: 100, align: 'right' },
                    { id: 'discounts', header: 'Discounts', width: 100, align: 'right' },
                    { id: 'netSales', header: 'Net Sales', width: 100, align: 'right' }
                ]
            };

            // Draw table header
            let yPosition = doc.y;
            let xPosition = 40;  // Left margin

            // Add headers with background
            doc.fillColor('#f0f0f0');
            doc.rect(xPosition, yPosition, doc.page.width - 80, 20).fill();
            doc.fillColor('#000000');

            tableLayout.columns.forEach(column => {
                doc.font('Helvetica-Bold')
                   .fontSize(10)
                   .text(
                       column.header,
                       xPosition,
                       yPosition + 5,
                       {
                           width: column.width,
                           align: column.align || 'left'
                       }
                   );
                xPosition += column.width + tableLayout.columnSpacing;
            });

            // Draw data rows
            yPosition += 25;
            let alternate = false;

            data.forEach((row, index) => {
                // Add alternating row background
                if (alternate) {
                    doc.fillColor('#f9f9f9');
                    doc.rect(40, yPosition - 5, doc.page.width - 80, 20).fill();
                    doc.fillColor('#000000');
                }

                xPosition = 40;
                const totalDiscounts = row.productDiscounts + row.couponDiscounts;

                // Format date
                const date = new Date(row._id).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit'
                });

                // Add row data
                tableLayout.columns.forEach(column => {
                    let value = '';
                    switch(column.id) {
                        case 'date':
                            value = date;
                            break;
                        case 'orders':
                            value = row.ordersCount.toString();
                            break;
                        case 'sales':
                            value = row.totalSales.toFixed(2);
                            break;
                        case 'discounts':
                            value = totalDiscounts.toFixed(2);
                            break;
                        case 'netSales':
                            value = row.netSales.toFixed(2);
                            break;
                    }

                    doc.font('Helvetica')
                       .fontSize(9)
                       .text(
                           value,
                           xPosition,
                           yPosition,
                           {
                               width: column.width,
                               align: column.align || 'left'
                           }
                       );
                    xPosition += column.width + tableLayout.columnSpacing;
                });

                yPosition += 20;
                alternate = !alternate;

                // Add new page if needed
                if (yPosition > doc.page.height - 100) {
                    doc.addPage();
                    yPosition = 50;
                }
            });

            // Add totals row
            doc.moveDown(0.5);
            doc.strokeColor('#000000')
               .lineWidth(1)
               .moveTo(40, yPosition)
               .lineTo(doc.page.width - 40, yPosition)
               .stroke();

            yPosition += 10;
            xPosition = 40;

            // Add total row with bold font
            doc.font('Helvetica-Bold').fontSize(9);
            tableLayout.columns.forEach(column => {
                let value = '';
                switch(column.id) {
                    case 'date':
                        value = 'Total';
                        break;
                    case 'orders':
                        value = totals.orders.toString();
                        break;
                    case 'sales':
                        value = totals.totalSales.toFixed(2);
                        break;
                    case 'discounts':
                        value = totals.discounts.toFixed(2);
                        break;
                    case 'netSales':
                        value = totals.netSales.toFixed(2);
                        break;
                }

                doc.text(
                    value,
                    xPosition,
                    yPosition,
                    {
                        width: column.width,
                        align: column.align || 'left'
                    }
                );
                xPosition += column.width + tableLayout.columnSpacing;
            });

            doc.end();
            
        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');
            
            // Style for headers
            const headerStyle = {
                font: { bold: true, size: 12 },
                alignment: { horizontal: 'center' },
                fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                }
            };

            // Style for currency cells
            const currencyStyle = {
                numFmt: '₹#,##0.00',
                alignment: { horizontal: 'right' }
            };

            // Define columns with specific widths
            worksheet.columns = [
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Orders', key: 'orders', width: 10 },
                { header: 'Total Sales', key: 'totalSales', width: 15 },
                { header: 'Discounts', key: 'discounts', width: 15 },
                { header: 'Net Sales', key: 'netSales', width: 15 }
            ];
            
            // Apply header styles
            worksheet.getRow(1).eachCell(cell => {
                cell.style = headerStyle;
            });
            
            // Add data
            data.forEach(row => {
                const totalDiscounts = row.productDiscounts + row.couponDiscounts;
                worksheet.addRow({
                    date: new Date(row._id).toLocaleDateString(),
                    orders: row.ordersCount,
                    totalSales: row.totalSales,
                    discounts: totalDiscounts,
                    netSales: row.netSales
                });
            });

            // Add a blank row before totals
            worksheet.addRow([]);

            // Add totals row with bold formatting
            const totalsRow = worksheet.addRow({
                date: 'Totals',
                orders: totals.orders,
                totalSales: totals.totalSales,
                discounts: totals.discounts,
                netSales: totals.netSales
            });

            // Style totals row
            totalsRow.eachCell(cell => {
                cell.font = { bold: true };
                if (cell.col > 2) { // Apply currency format to amount columns
                    cell.numFmt = currencyStyle.numFmt;
                    cell.alignment = currencyStyle.alignment;
                }
            });

            // Apply currency formatting to amount columns for all data rows
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) { // Skip header row
                    ['totalSales', 'discounts', 'netSales'].forEach(key => {
                        const cell = row.getCell(worksheet.getColumn(key).number);
                        cell.numFmt = currencyStyle.numFmt;
                        cell.alignment = currencyStyle.alignment;
                    });
                }
            });

            // Add borders to all cells
            worksheet.eachRow(row => {
                row.eachCell(cell => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });
            
            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');
            
            await workbook.xlsx.write(res);
        }

    } catch (error) {
        console.error('Download report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const pageerror= (req,res)=>{
    res.render('pageerror');
}


const logout= async(req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log('Error found destroying admin',err);
                return res.render('pageerror')
            }
            res.redirect('/admin/admin-login');
        })
    } catch (error) {
        console.log('unexpected error during logout admin',error);
        res.redirect('/pageerror')
    }
}


module.exports= {
    loadLogin,
    login,
    loadDashboard,
    getDashboardData,
    getSalesReport,
    downloadReport,
    pageerror,
    logout,

    

}