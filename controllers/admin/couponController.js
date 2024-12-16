

const Coupon = require('../../models/couponSchema');




const getCoupons = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalCoupons = await Coupon.countDocuments();
        const totalPages = Math.ceil(totalCoupons / limit);

        const coupons = await Coupon.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // For AJAX requests
        if (req.xhr) {
            return res.json({
                coupons,
                currentPage: page,
                totalPages
            });
        }

        // For regular page load
        res.render('couponList', { 
            coupons, 
            currentPage: page, 
            totalPages 
        });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch coupons' 
        });
    }
};

const createCoupon = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            code, 
            validFrom, 
            expiryDate, 
            discountPercentage, 
            minPurchaseLimit 
        } = req.body;

        // Check if coupon code already exists
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({ 
                success: false, 
                message: 'A coupon with this code already exists' 
            });
        }

        const newCoupon = new Coupon({
            title,
            description,
            code: code.toUpperCase(),
            validFrom: new Date(validFrom),
            expiryDate: new Date(expiryDate),
            discountPercentage: discountPercentage || null,
            minPurchaseLimit: minPurchaseLimit || 0
        });

        await newCoupon.save();

        res.status(201).json({ 
            success: true, 
            message: 'Coupon created successfully',
            coupon: newCoupon 
        });
    } catch (error) {
        console.error('Coupon creation error:', error);
        
        // Handle mongoose duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                message: 'A coupon with this code already exists' 
            });
        }

        res.status(400).json({ 
            success: false, 
            message: error.message || 'Failed to create coupon' 
        });
    }
};


const checkCouponCode = async (req, res) => {
    try {
        const { code } = req.query;
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        
        res.json({ 
            exists: !!existingCoupon 
        });
    } catch (error) {
        res.status(500).json({ 
            exists: false, 
            message: 'Error checking coupon code' 
        });
    }
};


const getEditCouponPage = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ 
                success: false, 
                message: 'Coupon not found' 
            });
        }
        
        // Always return JSON for the edit operation
        res.json({ coupon });
    } catch (error) {
        console.error('Error fetching coupon for edit:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch coupon for editing' 
        });
    }
};

const updateCoupon = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            code, 
            validFrom, 
            expiryDate, 
            discountAmount, 
            discountPercentage, 
            minPurchaseLimit 
        } = req.body;

        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ 
                success: false, 
                message: 'Coupon not found' 
            });
        }

        // Update coupon fields
        coupon.title = title;
        coupon.description = description;
        coupon.code = code.toUpperCase();
        coupon.validFrom = new Date(validFrom);
        coupon.expiryDate = new Date(expiryDate);
        coupon.discountAmount = discountAmount || null;
        coupon.discountPercentage = discountPercentage || null;
        coupon.minPurchaseLimit = minPurchaseLimit;

        await coupon.save();

        res.status(200).json({ 
            success: true, 
            message: 'Coupon updated successfully',
            coupon 
        });
    } catch (error) {
        console.error('Coupon update error:', error);
        res.status(400).json({ 
            success: false, 
            message: error.message || 'Failed to update coupon' 
        });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);
        
        if (!coupon) {
            return res.status(404).json({ 
                success: false, 
                message: 'Coupon not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Coupon deleted successfully' 
        });
    } catch (error) {
        console.error('Coupon deletion error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete coupon' 
        });
    }
};

const toggleCouponStatus = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        
        if (!coupon) {
            return res.status(404).json({ 
                success: false, 
                message: 'Coupon not found' 
            });
        }

        // Toggle status between 'active' and 'inactive'
        coupon.status = coupon.status === 'active' ? 'inactive' : 'active';
        
        await coupon.save();

        res.status(200).json({ 
            success: true, 
            message: 'Coupon status updated successfully',
            status: coupon.status 
        });
    } catch (error) {
        console.error('Coupon status toggle error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to toggle coupon status' 
        });
    }
};









module.exports= {
    getCoupons,
    createCoupon,
    checkCouponCode,
    getEditCouponPage,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus,

}