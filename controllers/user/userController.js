
const User = require('../../models/userSchema');
const Category= require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema')
const Offer = require('../../models/offerSchema');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const session= require("express-session");
const env = require('dotenv').config();
const Wishlist = require('../../models/wishlistSchema')
const Referral = require('../../models/referralSchema');
const Wallet = require('../../models/walletSchema')


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
        res.render('user-error', { error: 'Login page not loading' }); 
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
        res.redirect('/user-error')
    }
    
}
 

const loadSignup = async (req, res) => {
    try {
        return res.render('signup');
    } catch (error) {
        console.log('Signup page not loading: ', error);
        res.redirect('/user-error')
    }
}


const signUp = async (req, res) => {
    try {
        const { name, phone, email, password, cPassword, referralCode } = req.body;

        // Password match validation
        if (password !== cPassword) {
            return res.render("signup", { 
                message: "Passwords do not match",
                inputData: req.body
            });
        }

        // Check existing user
        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { 
                message: "An account with this email already exists",
                inputData: req.body
            });
        }

        // Check referral code if provided
        let referrer = null;
        if (referralCode) {
            const referral = await Referral.findOne({ 
                referralCode: referralCode,
                status: 'Active' // Check only if the referral is active
            });

            if (!referral) {
                return res.render("signup", { 
                    message: "Invalid or expired referral code",
                    inputData: req.body
                });
            }
            referrer = referral.referrer;
        }
        
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.json("email-error");
        }

        req.session.userOtp = otp;
        req.session.userData = { 
            name, 
            phone, 
            email, 
            password,
            referralCode,
            referrerId: referrer ? referrer.toString() : null
        };
        res.render("verify-otp");
        console.log("OTP Sent:", otp);
    } catch (error) {
        console.error("Signup error", error);
        res.redirect("/user-error");
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
            const userData = req.session.userData;
            const passwordHash = await securePassword(userData.password);

            // Create new user
            const newUser = new User({
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                password: passwordHash
            });
            await newUser.save();

            // Create wallet for new user with 0 balance initially
            const newUserWallet = new Wallet({
                userId: newUser._id,
                balance: 0,
                transactions: []
            });
            await newUserWallet.save();

            // Handle referral if code was provided
            if (userData.referrerId && userData.referralCode) {
                try {
                    // First, find the referral and update it
                    const referral = await Referral.findOne({
                        referrer: userData.referrerId,
                        referralCode: userData.referralCode,
                        status: 'Active'
                    });

                    if (referral) {
                        // Add new referee to referees array
                        referral.referees.push({
                            user: newUser._id,
                            joinedAt: new Date(),
                            rewardStatus: 'Completed',
                            rewardAmount: 50
                        });

                        // Update total rewards
                        referral.totalRewards += 25; 
                        await referral.save();

                        // Credit referrer's wallet (₹25)
                        const referrerWallet = await Wallet.findOne({ userId: userData.referrerId });
                        if (referrerWallet) {
                            referrerWallet.balance += 25;
                            referrerWallet.transactions.push({
                                amount: 25,
                                type: 'credit',
                                description: 'Referral bonus for referring ' + newUser.email,
                                balance: referrerWallet.balance
                            });
                            await referrerWallet.save();
                        }

                        // Credit new user's wallet (₹50)
                        newUserWallet.balance += 50;
                        newUserWallet.transactions.push({
                            amount: 50,
                            type: 'credit',
                            description: 'Welcome bonus for using referral code',
                            balance: 50 // First transaction so balance is same as amount
                        });
                        await newUserWallet.save();

                        console.log('Referral rewards processed successfully');
                    }
                } catch (referralError) {
                    console.error('Error processing referral:', referralError);
                    // Continue with signup even if referral processing fails
                }
            }

            req.session.user = newUser;
            res.json({ success: true, redirectUrl: '/' });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, please try again" });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};


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
      res.redirect('/user-error');
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
        res.redirect('/user-error');
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
        const categoryFilter = req.query.category;
        const globalSearch = req.query.globalSearch === 'true';

        // Create a base query
        const query = {
            isBlocked: false,
            productName: { $regex: searchTerm, $options: 'i' }
        };

        // Handle category filtering
        if (categoryFilter && categoryFilter !== '') {
            const selectedCategory = await Category.findOne({ name: categoryFilter });
            if (selectedCategory) {
                if (!globalSearch) {
                    // If not global search, strictly match the selected category
                    query.category = selectedCategory._id;
                }
            }
        }

        // Get total count of matching products
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        // Find products matching the criteria
        let products = await Product.find(query)
            .populate('category')
            .skip(skip)
            .limit(limit)
            .lean();

        // Process products to include necessary information
        products = await Promise.all(products.map(async (product) => {
            // Find applicable offers
            const offers = await Offer.find({
                $or: [
                    { offerType: 'product', productIds: product._id },
                    { offerType: 'category', categoryIds: product.category._id }
                ],
                status: 'active',
                expireDate: { $gte: new Date() }
            });

            // Calculate best offer
            let bestOffer = null;
            let offerPercentage = 0;

            if (offers.length > 0) {
                bestOffer = offers.reduce((max, offer) => 
                    offer.discount > max.discount ? offer : max
                );
                offerPercentage = bestOffer.discount;
            }

            return {
                ...product,
                offerPercentage
            };
        }));

        // Prepare the response message
        let noProductsMessage = '';
        if (products.length === 0) {
            if (categoryFilter && !globalSearch) {
                noProductsMessage = `No products found for "${searchTerm}" in the "${categoryFilter}" category. 
                    Check the global search option to search across all categories.`;
            } else {
                noProductsMessage = `No products found for "${searchTerm}".`;
            }
        }

        // Send JSON response
        res.json({
            products,
            pagination: {
                currentPage: page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            noProductsMessage,
            searchTerm
        });

    } catch (error) {
        console.error('Search Products Error:', error);
        res.status(500).json({ error: 'Server Error during search' });
    }
};


const shopingPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const sort = req.query.sort || 'default';
        const categoryFilter = req.query.category || '';
        const user = req.session.user;
        
        // Get all listed categories
        const categories = await Category.find({ isListed: true });
        
        // Base query with isBlocked check
        let query = { isBlocked: false };

        // Add category filter if specified
        if (categoryFilter && categoryFilter !== '') {
            const selectedCategory = await Category.findOne({ 
                name: categoryFilter,
                isListed: true 
            });
            if (selectedCategory) {
                query.category = selectedCategory._id;
            }
        }

        const skip = (page - 1) * limit;

        // First, get all products matching the query
        let products = await Product.find(query)
            .populate('category')
            .lean();

        // Get current date for offer validation
        const currentDate = new Date();

        // Fetch all active offers
        const offers = await Offer.find({
            status: 'active',
            expireDate: { $gte: currentDate }
        });

        // Calculate effective prices and add offer information
        products = await Promise.all(products.map(async (product) => {
            // Find applicable offers
            const productOffers = offers.filter(offer =>
                offer.offerType === 'product' &&
                offer.productIds.some(id => id.toString() === product._id.toString())
            );

            const categoryOffers = offers.filter(offer =>
                offer.offerType === 'category' &&
                offer.categoryIds.some(id => id.toString() === product.category._id.toString())
            );

            const allProductOffers = [...productOffers, ...categoryOffers];

            // Calculate best discount
            let bestOffer = null;
            let offerPercentage = 0;

            if (allProductOffers.length > 0) {
                bestOffer = allProductOffers.reduce((maxOffer, currentOffer) =>
                    (currentOffer.discount > maxOffer.discount) ? currentOffer : maxOffer
                );
                offerPercentage = bestOffer.discount;
            }

            // Calculate effective price
            const effectivePrice = offerPercentage
                ? product.regularPrice * (1 - offerPercentage / 100)
                : product.regularPrice;

            // Get first image
            const firstImage = product.variants.reduce((img, variant) => {
                if (!img && variant.images && variant.images.length > 0) {
                    return variant.images[0].filename;
                }
                return img;
            }, null);

            // Check wishlist status
            let isInWishlist = false;
            if (req.session.user) {
                const wishlist = await Wishlist.findOne({
                    userId: req.session.user._id,
                    'products.productId': product._id
                });
                isInWishlist = !!wishlist;
            }

            return {
                ...product,
                effectivePrice,
                regularPrice: product.regularPrice,
                offerPercentage,
                bestOffer,
                productImages: [firstImage || 'default-image.jpg'],
                isInWishlist
            };
        }));

        // Apply sorting
        switch(sort) {
            case 'price-low':
                products.sort((a, b) => a.effectivePrice - b.effectivePrice);
                break;
            case 'price-high':
                products.sort((a, b) => b.effectivePrice - a.effectivePrice);
                break;
            case 'name-asc':
                products.sort((a, b) => a.productName.localeCompare(b.productName));
                break;
            case 'name-desc':
                products.sort((a, b) => b.productName.localeCompare(a.productName));
                break;
            case 'new-arrivals':
                products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            default:
                products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        // Apply pagination after sorting
        const totalProducts = products.length;
        const totalPages = Math.ceil(totalProducts / limit);
        
        // Validate page number
        if (page > totalPages) {
            return res.redirect(`/shop-page?page=1&sort=${sort}&category=${categoryFilter || ''}`);
        }

        // Slice products for pagination
        products = products.slice(skip, skip + limit);

        const pagination = {
            currentPage: page,
            totalPages: totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            pages: Array.from({ length: totalPages }, (_, i) => i + 1),
            startPage: Math.max(1, page - 2),
            endPage: Math.min(totalPages, page + 2)
        };

        const renderData = {
            products,
            pagination,
            currentSort: sort,
            currentCategory: categoryFilter,
            categories,
            itemsPerPage: limit,
            totalItems: totalProducts
        };

        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json(renderData);
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

        let maxDiscount = 0;
        let applicableOfferName = '';
        
        offers.forEach(offer => {
            if (offer.offerType === 'product' && offer.productIds.includes(productId)) {
                maxDiscount = Math.max(maxDiscount, offer.discount);
                applicableOfferName = offer.offerName;
            } else if (offer.offerType === 'category' && offer.categoryIds.includes(product.category._id)) {
                maxDiscount = Math.max(maxDiscount, offer.discount);
                applicableOfferName = offer.offerName;
            }
        });

        // Calculate discounted price
        const discountedPrice = product.regularPrice * (1 - maxDiscount / 100);

        // Fetch related products from the same category
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id }, // Exclude current product
            isBlocked: false
        })
        .populate('category')
        .limit(4) // Show only 4 related products
        .lean();

        // Calculate offers for related products
        const relatedProductsWithOffers = await Promise.all(relatedProducts.map(async (relatedProduct) => {
            const productOffers = await Offer.find({
                $or: [
                    { offerType: 'product', productIds: relatedProduct._id },
                    { offerType: 'category', categoryIds: relatedProduct.category._id }
                ],
                status: 'active',
                expireDate: { $gte: new Date() }
            });

            let maxOfferPercentage = 0;
            productOffers.forEach(offer => {
                maxOfferPercentage = Math.max(maxOfferPercentage, offer.discount);
            });

            return {
                ...relatedProduct,
                offerPercentage: maxOfferPercentage
            };
        }));

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
                applicableOfferName
            },
            variants,
            initialVariant,
            variantSizes,
            categoryName: product.category.name,
            relatedProducts: relatedProductsWithOffers,
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

 
 
const getProductForCart = async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId)
            .populate('category')
            .select('productName regularPrice variants');
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product details' });
    }
};


const getProductOffers = async (req, res) => {
    try {
        const productId = req.params.productId;
        const product = await Product.findById(productId).populate('category');
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const offers = await Offer.find({
            $or: [
                { offerType: 'product', productIds: productId },
                { offerType: 'category', categoryIds: product.category._id }
            ],
            status: 'active',
            expireDate: { $gte: new Date() }
        });

        res.json({ offers });
    } catch (error) {
        console.error('Error fetching offers:', error);
        res.status(500).json({ message: 'Failed to fetch offers' });
    }
};
 
 

module.exports = {
    loadHomePage,
   
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
    getProductForCart,
    getProductOffers,
   


    
    
};
 
