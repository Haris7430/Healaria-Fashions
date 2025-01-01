
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
                return res.redirect('/admin/admin-dashboard') // Changed from /admin/admin-dashboard
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


const loadDashboard= async(req,res)=>{
    if(req.session.isAdmin){
        try{
            res.render('admin-dashboard');
        } catch(error){
            res.redirect('/pageerror')
        }
    }
}




const getDashboardData = async (req, res) => {
    try {
        
        const currentDate = new Date();
        const previousMonth = new Date(currentDate.setMonth(currentDate.getMonth() - 1));

        // Current period metrics
        const currentPeriodOrders = await Order.find({
            createdAt: { $gte: previousMonth },
            status: { $ne: 'cancelled' }
        });
       

        const previousPeriodStart = new Date(previousMonth.setMonth(previousMonth.getMonth() - 1));
        const previousPeriodOrders = await Order.find({
            createdAt: { 
                $gte: previousPeriodStart,
                $lt: previousMonth
            },
            status: { $ne: 'cancelled' }
        });

        

        // Calculate total discounts including coupon discounts
        const calculateTotalDiscounts = (orders) => {
            return orders.reduce((total, order) => {
                const productDiscounts = order.totalDiscount || 0;
                const couponDiscount = order.couponApplied?.discountAmount || 0;
                return total + productDiscounts + couponDiscount;
            }, 0);
        };

        // Calculate metrics with updated discount calculation
        const currentRevenue = currentPeriodOrders.reduce((sum, order) => sum + order.total, 0);
        const currentOrderCount = currentPeriodOrders.length;
        const currentTotalDiscounts = calculateTotalDiscounts(currentPeriodOrders);
        
        const previousRevenue = previousPeriodOrders.reduce((sum, order) => sum + order.total, 0);
        const previousOrderCount = previousPeriodOrders.length;
        const previousTotalDiscounts = calculateTotalDiscounts(previousPeriodOrders);

        // Calculate growth rates
        const revenueGrowth = previousRevenue ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
        const orderGrowth = previousOrderCount ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100 : 0;
        const discountGrowth = previousTotalDiscounts ? ((currentTotalDiscounts - previousTotalDiscounts) / previousTotalDiscounts) * 100 : 0;
       
        // Get customer metrics
        const currentCustomers = await User.countDocuments({
            createdAt: { $gte: previousMonth },
            isAdmin: false
        });
        const previousCustomers = await User.countDocuments({
            createdAt: {
                $gte: previousPeriodStart,
                $lt: previousMonth
            },
            isAdmin: false
        });
        const customerGrowth = previousCustomers ? ((currentCustomers - previousCustomers) / previousCustomers) * 100 : 0;

        // Get total metrics
        const totalRevenue = await Order.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);

        const totalOrders = await Order.countDocuments({ status: { $ne: 'cancelled' } });
        const totalCustomers = await User.countDocuments({ isAdmin: false });
        const totalDiscounts = await Order.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: {
                _id: null,
                productDiscounts: { $sum: '$totalDiscount' },
                couponDiscounts: { $sum: { $ifNull: ['$couponApplied.discountAmount', 0] } }
            }}
        ]);

        // Get top 10 products
        const topProducts = await Order.aggregate([
            { $unwind: '$items' },
            { $group: {
                _id: '$items.productId',
                totalSales: { $sum: '$items.quantity' },
                revenue: { $sum: '$items.totalPrice' }
            }},
            { $sort: { totalSales: -1 } },
            { $limit: 10 },
            { $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'product'
            }},
            { $unwind: '$product' }
        ]);

        // Get top categories
        const topCategories = await Order.aggregate([
            { $unwind: '$items' },
            { $lookup: {
                from: 'products',
                localField: 'items.productId',
                foreignField: '_id',
                as: 'product'
            }},
            { $unwind: '$product' },
            { $group: {
                _id: '$product.category',
                totalSales: { $sum: '$items.quantity' },
                revenue: { $sum: '$items.totalPrice' }
            }},
            { $sort: { totalSales: -1 } },
            { $limit: 10 },
            { $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'category'
            }},
            { $unwind: '$category' }
        ]);

        res.json({
            totalRevenue: currentRevenue,
            totalOrders,
            totalCustomers,
            totalDiscounts: (totalDiscounts[0]?.productDiscounts || 0) + (totalDiscounts[0]?.couponDiscounts || 0),
            revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
            orderGrowth: parseFloat(orderGrowth.toFixed(2)),
            discountGrowth: parseFloat(discountGrowth.toFixed(2)),
            topProducts: topProducts.map(p => ({
                name: p.product.productName,
                sales: p.totalSales,
                revenue: p.revenue
            })),
            topCategories: topCategories.map(c => ({
                name: c.category.name,
                sales: c.totalSales,
                revenue: c.revenue
            }))
        });

    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};



// Add these helper functions at the top of adminController.js

const constructDateQuery = (range, startDate, endDate) => {
    const now = new Date();
    let dateQuery = {};

    switch (range) {
        case 'daily':
            dateQuery = {
                createdAt: {
                    $gte: new Date(now.setHours(0, 0, 0, 0)),
                    $lt: new Date(now.setHours(23, 59, 59, 999))
                }
            };
            break;
        case 'weekly':
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateQuery = { createdAt: { $gte: weekAgo } };
            break;
        case 'monthly':
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateQuery = { createdAt: { $gte: monthAgo } };
            break;
        case 'yearly':
            const yearAgo = new Date(now);
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            dateQuery = { createdAt: { $gte: yearAgo } };
            break;
        case 'custom':
            if (startDate && endDate) {
                dateQuery = {
                    createdAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                    }
                };
            }
            break;
    }
    return dateQuery;
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

        if (format === 'pdf') {
            const doc = new PDFDocument();
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
            
            doc.pipe(res);
            
            // Add PDF content
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            
            // Add table headers
            const headers = ['Date', 'Orders', 'Total Sales', 'Discounts', 'Net Sales'];
            let yPosition = 150;
            
            headers.forEach((header, i) => {
                doc.text(header, 50 + (i * 100), yPosition);
            });
            
            // Add data rows
            data.forEach((row, index) => {
                yPosition = 180 + (index * 30);
                const totalDiscounts = row.productDiscounts + row.couponDiscounts;
                
                doc.text(new Date(row._id).toLocaleDateString(), 50, yPosition);
        doc.text(row.ordersCount.toString(), 150, yPosition);
        doc.text(`Rs ${row.totalSales.toFixed(2)}`, 250, yPosition);
        doc.text(`Rs ${totalDiscounts.toFixed(2)}`, 350, yPosition);
        doc.text(`Rs ${row.netSales.toFixed(2)}`, 450, yPosition);
            });
            
            doc.end();
            
        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');
            
            // Add headers
            worksheet.addRow(['Date', 'Orders', 'Total Sales', 'Discounts', 'Net Sales']);
            
            // Add data
            data.forEach(row => {
                const totalDiscounts = row.productDiscounts + row.couponDiscounts;
                worksheet.addRow([
                    new Date(row._id).toLocaleDateString(),
                    row.ordersCount,
                    row.totalSales,
                    totalDiscounts,
                    row.netSales
                ]);
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