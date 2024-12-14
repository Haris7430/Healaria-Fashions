const User = require('../../models/userSchema');
const Category= require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema')
const Offer = require('../../models/offerSchema');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const session= require("express-session");

const env = require('dotenv').config();


function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`
        });

        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}


const pageNotFound = async (req, res) => {
    try {
        res.status(404).render("page-404");
    } catch (error) {
        res.redirect("/page-404");
    }
}


const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({isListed: true});
        
        // Find active offers
        const activeOffers = await Offer.find({
            status: 'active',
            isListed: true,
            expireDate: { $gte: new Date() }
        });

        let productData = await Product.find({
            isBlocked: false,
            category: {$in: categories.map(category => category._id)}
        }).populate('category');

        // Process offers and calculate best discount for each product
        const productsWithOffers = productData.map(product => {
            // Find product-specific offers
            const productOffers = activeOffers.filter(offer => 
                offer.offerType === 'product' && 
                offer.productIds.some(id => id.toString() === product._id.toString())
            );

            // Find category offers
            const categoryOffers = activeOffers.filter(offer => 
                offer.offerType === 'category' && 
                offer.categoryIds.some(id => id.toString() === product.category._id.toString())
            );

            // Combine and find maximum offer
            const allRelevantOffers = [...productOffers, ...categoryOffers];
            const maxOffer = allRelevantOffers.length > 0 
                ? Math.max(...allRelevantOffers.map(offer => offer.discount))
                : 0;

            // Calculate offer price
            const offerPrice = maxOffer > 0 
                ? product.regularPrice * (1 - maxOffer / 100)
                : null;

            return {
                ...product.toObject(),
                maxOfferPercentage: maxOffer,
                offerPrice: offerPrice ? Math.round(offerPrice) : null
            };
        });

        // Sort by createdAt timestamp
        productsWithOffers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Limit to 8 products
        const limitedProducts = productsWithOffers.slice(0, 8);

        if (user) {
            const userData = await User.findOne({_id: user._id});
            res.render("home", {user: userData, products: limitedProducts});
        } else {
            return res.render('home', {products: limitedProducts});
        }
        
    } catch (error) {
        console.log('Home Page Not Found', error);
        res.status(500).send('Server Error Home Page Not Found');
    }
}


const loadLogin = async (req, res) => {
    try {
        
        if(!req.session.user){
            return res.render('login')
        } else {
            res.redirect('/')
        }

    } catch (error) {
        console.log('Login page not loading: ', error);
        res.redirect("/pageNotFound")
    }
}


const login= async(req,res)=>{
    try{
    
        const {email,password}=req.body;
        console.log(req.body);

        const findUser= await User.findOne({isAdmin:0,email:email});
        console.log('User found',findUser);

        if(!findUser){
            return res.render('login',{message:"User not found"});
        }

        if(findUser.isBlocked){
            return res.render('login',{message:"User is blocked by admin"});
        }

        const passwordMatch= await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            return res.render('login',{message:'Incorrect Password'});
        }

        req.session.user= findUser;
        res.redirect('/')
    } catch(error){
        console.error('login error',error);
        res.render('login',{message:'login failed. Please try again later'})
        
    }
}


const logout= async (req,res) => {

    try {
        
        req.session.destroy((err)=>{
            if(err){
                console.log('session destruction error',err.message);
                return res.redirect('/pageNotFound')
            }
            return res.redirect('/login');
        })
    } catch (error) {
        console.log('Logount error',error);
        res.redirect('/pageNotFound')
    }
    
}
 

const loadSignup = async (req, res) => {
    try {
        return res.render('signup');
    } catch (error) {
        console.log('Signup page not loading: ', error);
        res.redirect('/pageNotFound')
    }
}


const signUp = async (req, res) => {
    try {
        const { name, phone, email, password, cPassword } = req.body;

        
        if (password !== cPassword) {
            return res.render("signup", { message: "Passwords do not match" });
        }

        
        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User with this email already exists" });
        }

        
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.json("email-error");
        }

       
        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };

        res.render("verify-otp");
        console.log("OTP Sent:", otp);
    } catch (error) {
        console.error("Signup error", error);
        res.redirect("/pageNotFound");
    }
}


const securePassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        console.error("Error securing password:", error);
        throw error;
    }
}


const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        

        
        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            
            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash
            });
            await saveUserData.save();

            
            req.session.user = saveUserData;
            res.json({ success: true, redirectUrl: '/' });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, please try again" });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
}


const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;

       
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        
        const otp = generateOtp();
        req.session.userOtp = otp;

        
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            console.log("Resend OTP:", otp);
            res.status(200).json({ success: true, message: "OTP Resent Successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again" });
        }
    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: "Internal Server Error. Please try again" });
    }
};







const getForgotPassword = async (req, res) => {
    try {
       res.render('forgot-password', { 
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (error) {
        console.log(error)
      res.redirect('/pageNotFound');
    }
};



  async function verificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        const mailOptions = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP password reset",
            text: `Your OTP is ${otp}`,
            html: `<b> <h4> Your OTP is ${otp} <h4> <br> </b>`
        });

        const info = await transporter.sendMail(mailOptions);
        console.log('Email send: ' , info.messageId);

        return true
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}


const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });
        
        if (findUser) {
            const otp = generateOtp();
            const emailSent = await verificationEmail(email, otp);
       
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgot-pass-otp");
                console.log('Forgot password OTP: ', otp);
            } else {
               
                res.render('forgot-password', {
                    error: 'Failed to send OTP. Please try again',
                    success: null  // Add this to ensure success is defined
                });
            }
        } else {
            
            res.render('forgot-password', {
                error: 'User with this email does not exist',
                success: null  // Add this to ensure success is defined
            });
        }
    } catch (error) {
       
        res.render('forgot-password', {
            error: 'An unexpected error occurred',
            success: null
        });
        console.log(error);
    }
}




const verifyForgotPassOtp = async (req,res) => {

    try {

        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp) {
            res.json({success:true,redirectUrl:'/reset-password'});
        } else {
            res.json({ success:false, message:"OTP not matching"})
        }
        
    } catch (error) {

        res.status(500).json({success:false, message:"An error occured. Please try again"});
        console.log("verifyForgotPassOtp", error)
        
    }
}



const getResetPassPage = async (req, res) => {
    try {
        res.render('reset-password', { message: null }); // Ensure 'message' is passed to the EJS file
    } catch (error) {
        console.error("Error rendering reset-password page:", error);
        res.redirect('/pageNotFound');
    }
};


const otpResend= async (req,res)=>{
    try {

        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("Resending OTP to email: ", email);
        const emailSent= await sendVerificationEmail(email,otp);
        if(emailSent) {
            console.log("Resend OTP: ",otp);
            res.status(200).json({success:true, message:'Resend OTP Successful'});
        }
        
    } catch (error) {

        console.error("Error in Resending otp", error);
        res.status(500).json({success:false, message:' Internal Server Error'});
        
    }
}

const passwordSecure = async (password) => {
    try {
        return await bcrypt.hash(password, 10); 
    } catch (error) {
        console.error("Error securing password:", error);
        throw error;
    }
};



const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;

        // Check if passwords match
        if (newPass1 !== newPass2) {
            return res.status(400).json({ 
                message: 'Passwords do not match.' 
            });
        }

        // Validate password length
        if (newPass1.length < 8) {
            return res.status(400).json({ 
                message: 'Password must be at least 8 characters long.' 
            });
        }

        // Hash the new password
        const passwordHash = await passwordSecure(newPass1);

        // Update the password in the database
        const updatedUser = await User.updateOne(
            { email: email },
            { $set: { password: passwordHash } }
        );

        if (updatedUser.matchedCount === 0) {
            return res.status(404).json({ 
                message: 'User not found. Please try again.' 
            });
        }

        // Clear the session
        req.session.email = null;

        // Send a success response with redirect URL
        res.json({ 
            success: true, 
            redirectUrl: '/login' 
        });
    } catch (error) {
        console.error("Error during password reset:", error);
        res.status(500).json({ 
            message: 'An error occurred. Please try again.' 
        });
    }
};




const searchProducts = async (req, res) => {
    try {
        const searchTerm = req.query.q ? req.query.q.toString() : '';
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;
        const categoryFilter = req.query.category; // Get category filter
        const globalSearch = req.query.globalSearch === 'true'; // Check if global search is enabled

        // Create a base query
        const query = {
            isBlocked: false,
            productName: { $regex: searchTerm, $options: 'i' }
        };

        // If a specific category is selected
        if (categoryFilter) {
            const selectedCategory = await Category.findOne({ name: categoryFilter });
            if (selectedCategory) {
                // If not global search, strictly match the selected category
                if (!globalSearch) {
                    query.category = selectedCategory._id;
                } else {
                    // If global search, include all categories
                    const categories = await Category.find({ isListed: true });
                    query.category = { $in: categories.map(cat => cat._id) };
                }
            }
        }

        // Get total count of matching products
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        // Find products matching the search term
        let products = await Product.find(query)
            .populate('category')
            .skip(skip)
            .limit(limit)
            .lean();

        // Process products to get first image
        products = products.map(product => {
            const firstImage = product.variants.reduce((img, variant) => {
                if (!img && variant.images && variant.images.length > 0) {
                    return variant.images[0].filename;
                }
                return img;
            }, null);

            return {
                ...product,
                productImages: [firstImage || 'default-image.jpg']
            };
        });

        // Get all categories for the filter
        const categories = await Category.find({ isListed: true });

        // Prepare pagination data
        const pagination = {
            currentPage: page,
            totalPages: totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            pages: Array.from({ length: totalPages }, (_, i) => i + 1)
        };

        // Determine no products message
        let noProductsMessage = '';
        if (products.length === 0) {
            if (categoryFilter && !globalSearch) {
                noProductsMessage = `No products found for "${searchTerm}" in the "${categoryFilter}" category. 
                Check the global search option to search across all categories.`;
            } else {
                noProductsMessage = `No products found for "${searchTerm}".`;
            }
        }

        // Render search results
        res.render('shop-page', {
            products: products,
            pagination: pagination,
            currentSort: 'default',
            searchTerm: searchTerm,
            currentCategory: categoryFilter || '',
            categories: categories,
            globalSearch: globalSearch,
            noProductsMessage: noProductsMessage
        });

    } catch (error) {
        console.error('Search Products Error:', error);
        res.status(500).send('Server Error during search');
    }
};


const shopingPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9; 
        const sort = req.query.sort || 'default';
        const categoryFilter = req.query.category; // New category filter
        const user = req.session.user;
        
        // Get all listed categories
        const categories = await Category.find({ isListed: true });
        
        // Base query 
        let query = {
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
        };

        // Add category filter to query if specified
        if (categoryFilter) {
            const selectedCategory = await Category.findOne({ name: categoryFilter });
            if (selectedCategory) {
                query.category = selectedCategory._id;
            }
        }

        const skip = (page - 1) * limit;

        // Sort criteria logic remains the same as before
        let sortCriteria = {};
        switch(sort) {
            case 'price-low':
                sortCriteria = { regularPrice: 1 };
                break;
            case 'price-high':
                sortCriteria = { regularPrice: -1 };
                break;
            case 'name-asc':
                sortCriteria = { productName: 1 };
                break;
            case 'name-desc':
                sortCriteria = { productName: -1 };
                break;
            case 'new-arrivals':
                sortCriteria = { createdAt: -1 };
                break;
            default:
                sortCriteria = { createdAt: -1 };
        }

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        // Validate page number
        if (page > totalPages) {
            return res.redirect(`/shop-page?page=1&sort=${sort}&category=${categoryFilter || ''}`);
        }

        // Get products with pagination and sorting
        let products = await Product.find(query)
            .populate('category')
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit)
            .lean(); 

        // Get current date for offer calculations
        const currentDate = new Date();

        // Find active offers
        const offers = await Offer.find({
            status: 'active',
            expireDate: { $gte: currentDate }
        });

        // Calculate the best offer for each product
        products = await Promise.all(products.map(async (product) => {
            let bestOffer = null;
            let offerPercentage = 0;

            // Find product-specific offers
            const productOffers = offers.filter(offer =>
                offer.offerType === 'product' &&
                offer.productIds.some(id => id.toString() === product._id.toString())
            );

            // Find category-specific offers
            const categoryOffers = offers.filter(offer =>
                offer.offerType === 'category' &&
                offer.categoryIds.some(id => id.toString() === product.category._id.toString())
            );

            // Combine all applicable offers
            const allProductOffers = [...productOffers, ...categoryOffers];

            // Find the best offer
            if (allProductOffers.length > 0) {
                bestOffer = allProductOffers.reduce((maxOffer, currentOffer) =>
                    (currentOffer.discount > maxOffer.discount) ? currentOffer : maxOffer
                );
                offerPercentage = bestOffer.discount;
            }

            // Calculate the offer price
            const offerPrice = offerPercentage
                ? product.regularPrice * (1 - offerPercentage / 100)
                : null;

            // Get the first image
            const firstImage = product.variants.reduce((img, variant) => {
                if (!img && variant.images && variant.images.length > 0) {
                    return variant.images[0].filename;
                }
                return img;
            }, null);

            return {
                ...product,
                productImages: [firstImage || 'default-image.jpg'],
                bestOffer: bestOffer,
                offerPercentage: offerPercentage,
                offerPrice: offerPrice
            };
        }));


        // Pagination logic remains the same
        const pagination = {
            currentPage: page,
            totalPages: totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            pages: Array.from({ length: totalPages }, (_, i) => i + 1),
            startPage: Math.max(1, page - 2),
            endPage: Math.min(totalPages, page + 2)
        };

        // Render data
        const renderData = {
            products: products,
            pagination: pagination,
            currentSort: sort,
            currentCategory: categoryFilter || '',
            categories: categories, 
            itemsPerPage: limit,
            totalItems: totalProducts
        };

        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({
                products,
                pagination,
                currentSort: sort,
                currentCategory: categoryFilter || ''
            });
        }

        if (user) {
            const userData = await User.findOne({ _id: user._id }).lean();
            renderData.user = userData;
        }

        res.render("shop-page", renderData);
    } catch (error) {
        console.log('Shop Page Error:', error);
        res.status(500).send('Server Error: Shop Page Not Found');
    }
};
 

// userController.js - Updated getProductDetails function
const getProductDetails = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId)
            .populate('category')
            .populate('variants');
        
        if (!product) {
            return res.status(404).render('error', { message: 'Product not found' });
        }

        // Find applicable offers
        const offers = await Offer.find({
            $or: [
                { offerType: 'product', productIds: productId },
                { offerType: 'category', categoryIds: product.category._id }
            ],
            status: 'active',
            expireDate: { $gte: new Date() }
        });

        // Calculate the maximum discount
        let maxDiscount = 0;
        let applicableOfferType = '';
        
        offers.forEach(offer => {
            if (offer.offerType === 'product') {
                maxDiscount = Math.max(maxDiscount, offer.discount);
                applicableOfferType = 'Product Offer';
            } else if (offer.offerType === 'category') {
                maxDiscount = Math.max(maxDiscount, offer.discount);
                applicableOfferType = 'Category Offer';
            }
        });

        // Calculate discounted price
        const discountedPrice = product.regularPrice * (1 - maxDiscount / 100);

        const variants = product.variants.filter(variant => variant.isListed);
        const initialVariant = variants[0];

        const variantSizes = initialVariant.sizes.map(sizeObj => ({
            size: sizeObj.size,
            quantity: sizeObj.quantity
        }));

        res.render('product', {
            product: {
                ...product.toObject(),
                regularPrice: product.regularPrice,
                discountedPrice: discountedPrice,
                maxDiscount,
                applicableOfferType
            },
            variants,
            initialVariant,
            variantSizes,
            categoryName: product.category.name,
            isLoggedIn: !!req.session.user,
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).render('error', { message: 'Internal Server Error' });
    }
};



const getVariantDetails = async (req, res) => {
    try {
        const { productId, variantId } = req.params;
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const variant = product.variants.id(variantId);
        if (!variant) {
            return res.status(404).json({ message: 'Variant not found' });
        }

        // Transform variant images with full path
        const images = variant.images.map(img => ({
            filename: img.filename,
            fullPath: `/uploads/product-images/${img.filename}`
        }));

        const sizes = variant.sizes.map(sizeObj => ({
            size: sizeObj.size,
            quantity: sizeObj.quantity
        }));

        res.json({
            images,
            sizes
        });
    } catch (error) {
        console.error('Get Variant Details Error:', error);
        res.status(500).json({ message: 'Failed to fetch variant details' });
    }
};

 
 

 
 

module.exports = {
    loadHomePage,
    pageNotFound,
    loadLogin,
    login,
    logout,
    loadSignup,
    signUp,
    verifyOtp,
    resendOtp,
    getForgotPassword,
    verificationEmail,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    otpResend,
    postNewPassword,
    searchProducts,
    shopingPage,
    getProductDetails,
    getVariantDetails,
   


    
    
};
 
