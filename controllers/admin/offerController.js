
const Offer = require('../../models/offerSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

const renderOffersPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const searchQuery = req.query.search ? {
            $or: [
                { offerName: { $regex: req.query.search, $options: 'i' } },
                { offerType: { $regex: req.query.search, $options: 'i' } }
            ]
        } : {};

        const totalOffers = await Offer.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalOffers / limit);

        const offers = await Offer.find(searchQuery)
            .sort({ createdAt: -1 }) // Sort by creation date in descending order
            .skip(skip)
            .limit(limit)
            .populate('productIds', 'productName')
            .populate('categoryIds', 'name');

        // Check if it's an AJAX request
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({
                offers,
                currentPage: page,
                totalPages,
                search: req.query.search || ''
            });
        }

        res.render('offerProduct', {
            offers,
            currentPage: page,
            totalPages,
            search: req.query.search || ''
        });
    } catch (error) {
        console.error('Error rendering offers page:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to load offers',
            error: error.message 
        });
    }
};


const checkExistingOffers = async (req, res) => {
    try {
        const { checkProducts, checkCategories } = req.query;
        
        let query;
        if (checkProducts) {
            // Check for active offers for specific products
            query = {
                offerType: 'product',
                status: 'active',
                productIds: { $in: checkProducts }
            };
        } else if (checkCategories) {
            // Check for active offers for specific categories
            query = {
                offerType: 'category',
                status: 'active',
                categoryIds: { $in: checkCategories }
            };
        } else {
            return res.json({ hasActiveOffers: false });
        }

        const existingOffers = await Offer.find(query);

        res.json({
            hasActiveOffers: existingOffers.length > 0,
            activeOffers: existingOffers
        });
    } catch (error) {
        console.error('Error checking existing offers:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to check existing offers',
            error: error.message 
        });
    }
};

const renderCreateOfferPage = async (req, res) => {
    try {
        const { type } = req.query;
        const products = await Product.find({ isBlocked: false });
        const categories = await Category.find({ isListed: true });
        
        if (type === 'product') {
            res.render('createProductOffer', { 
                products, 
                categories 
            });
        } else if (type === 'category') {
            res.render('createCategoryOffer', { 
                products, 
                categories 
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid offer type' 
            });
        }
    } catch (error) {
        console.error('Error rendering create offer page:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to load create offer page',
            error: error.message 
        });
    }
};

const createOffer = async (req, res) => {
    try {
        const {  
            offerType, 
            offerName, 
            discount, 
            expireDate, 
            productIds, 
            categoryIds 
        } = req.body;

        // Check for existing offer with the same name
        const existingOffer = await Offer.findOne({ offerName: offerName });
        if (existingOffer) {
            return res.status(400).json({ 
                success: false, 
                message: 'An offer with this name already exists',
                field: 'offerName'
            });
        }

        const newOffer = new Offer({
            offerType,
            offerName,
            discount: parseFloat(discount),
            expireDate: new Date(expireDate),
            productIds: offerType === 'product' ? productIds : [],
            categoryIds: offerType === 'category' ? categoryIds : [],
            status: 'active'
        });

        await newOffer.save();

        res.status(201).json({ 
            success: true, 
            message: 'Offer created successfully',
            offer: newOffer 
        });
    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create offer',
            error: error.message 
        });
    }
}; 

const renderEditOfferPage = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id);
        const products = await Product.find({ isBlocked: false });
        const categories = await Category.find({ isListed: true });

        if (!offer) {
            return res.status(404).json({ 
                success: false, 
                message: 'Offer not found' 
            });
        }

        // Differentiate between product and category offer edit pages
        if (offer.offerType === 'product') {
            res.render('editProductOffer', { 
                offer, 
                products, 
                categories 
            });
        } else if (offer.offerType === 'category') {
            res.render('editCategoryOffer', { 
                offer, 
                products, 
                categories 
            }); 
        } else {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid offer type' 
            });
        }
    } catch (error) {
        console.error('Error rendering edit offer page:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to load edit offer page',
            error: error.message 
        });
    }
};

const updateOffer = async (req, res) => {
    try {
        const { 
            offerType, 
            offerName, 
            discount, 
            expireDate, 
            productIds, 
            categoryIds 
        } = req.body;

        // Check for existing offer with the same name (excluding the current offer)
        const existingOffer = await Offer.findOne({ 
            offerName: offerName, 
            _id: { $ne: req.params.id } 
        });

        if (existingOffer) {
            return res.status(400).json({ 
                success: false, 
                message: 'An offer with this name already exists',
                field: 'offerName'
            });
        }

        const updatedOffer = await Offer.findByIdAndUpdate(
            req.params.id,
            {
                offerType,
                offerName,
                discount: parseFloat(discount),
                expireDate: new Date(expireDate),
                productIds: offerType === 'product' ? productIds : [],
                categoryIds: offerType === 'category' ? categoryIds : [],
            },
            { new: true }
        );

        if (!updatedOffer) {
            return res.status(404).json({ 
                success: false, 
                message: 'Offer not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Offer updated successfully',
            offer: updatedOffer 
        });
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update offer',
            error: error.message 
        });
    }
};

const deleteOffer = async (req, res) => {
    try {
        const deletedOffer = await Offer.findByIdAndDelete(req.params.id);

        if (!deletedOffer) {
            return res.status(404).json({ 
                success: false, 
                message: 'Offer not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Offer deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete offer',
            error: error.message 
        });
    }
};

const toggleOfferStatus = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id);

        if (!offer) {
            return res.status(404).json({ 
                success: false, 
                message: 'Offer not found' 
            });
        }

        // Toggle both status and isListed 
        offer.status = offer.status === 'active' ? 'inactive' : 'active';
        offer.isListed = !offer.isListed;
        
        await offer.save();

        res.json({ 
            success: true, 
            message: `Offer ${offer.status} successfully`,
            status: offer.status,
            isListed: offer.isListed 
        });
    } catch (error) {
        console.error('Error toggling offer status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to toggle offer status',
            error: error.message 
        });
    }
};

const getProductsForOffer = async (req, res) => {
    try {
        const products = await Product.find({ isBlocked: false }, 'productName');
        res.json({ 
            success: true, 
            products 
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch products',
            error: error.message 
        });
    }
};

const getCategoriesForOffer = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true }, 'name');
        res.json({ 
            success: true, 
            categories 
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch categories',
            error: error.message 
        });
    }
};






module.exports = {
    renderOffersPage,
    checkExistingOffers,
    renderCreateOfferPage,
    createOffer,
    renderEditOfferPage,
    updateOffer,
    deleteOffer,
    toggleOfferStatus,
    getProductsForOffer,
    getCategoriesForOffer,


}