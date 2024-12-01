const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const mongoose = require('mongoose');
const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

const getProductAddPage = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        res.render('product-add', {
            cat: categories,
            
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.redirect('/admin/pageerror');
    }
};


const addProducts = async (req, res) => {
    try {
        const { productName, description, regularPrice, salePrice, color, quantity, category, size } = req.body;

        const errors = {};

        // Validation checks
        if (!productName || productName.trim().length === 0) {
            errors.productName = 'Product name is required';
        }

        // Optional description validation
        if (description && description.trim().length > 500) {
            errors.description = 'Description too long (max 500 characters)';
        }

        if (!regularPrice || isNaN(regularPrice) || regularPrice <= 0) {
            errors.regularPrice = 'Valid regular price is required';
        }

        if (salePrice && (!isNaN(salePrice) && parseFloat(salePrice) >= parseFloat(regularPrice))) {
            errors.salePrice = 'Sale price must be less than regular price';
        }

        if (!quantity || isNaN(quantity) || quantity < 0) {
            errors.quantity = 'Valid quantity is required';
        }

        if (!color || color.trim().length === 0) {
            errors.color = 'Color is required';
        }

        if (!size) {
            errors.size = 'Size is required';
        }

        if (!category) {
            errors.category = 'Category is required';
        }

        if (!req.files || req.files.length < 3) {
            errors.images = 'At least 3 images are required';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).render('product-add', { 
                errors, 
                cat: await Category.find({ isListed: true }),
                formData: req.body 
            });
        }

        const images = await Promise.all(req.files.map(async (file, index) => {
            const filename = `${Date.now()}-${index}-${file.originalname}`;
            const outputPath = path.join('public', 'uploads', 'product-images', filename);
            
            await sharp(file.buffer)
                .jpeg({ quality: 90 })
                .toFile(outputPath);
            
            return {
                filename,
                contentType: 'image/jpeg',
                // Mark first image as main
                isMainImage: index === 0 
            };
        }));

        const categoryId = await Category.findOne({ name: category });
        if (!categoryId) {
            return res.redirect('/admin/products?error=Invalid category name');
        }

        const newProduct = new Product({
            productName,
            description,
            regularPrice,
            salesPrice: salePrice,
            variants: [{
                color,
                sizes: [{ size, quantity }],
                images: images,
                mainImage: true // Set first variant as main
            }],
            category: categoryId._id
        });

        await newProduct.save();
        
        res.redirect('/admin/products');
        
    } catch (error) {
        console.error('Error saving product:', error);
        res.status(500).render('product-add', { 
            errors: { general: 'Error saving product' }, 
            cat: await Category.find({ isListed: true }),
            formData: req.body 
        });
    }
};






 
const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } }
            ]
        })
        .limit(limit)
        .skip((page - 1) * limit)
        .populate('category')
        .exec();

        // Modify to set first image as main image
        const productsWithMainImage = productData.map(product => {
            const updatedProduct = { ...product.toObject() };
            // Find first image in first variant and mark as main
            if (updatedProduct.variants.length > 0 && updatedProduct.variants[0].images.length > 0) {
                updatedProduct.variants[0].mainImage = true;
            }
            return updatedProduct;
        });

        const count = await Product.countDocuments({
            $or: [
                { productName: { $regex: new RegExp('.*' + search + '.*', 'i') } }
            ]
        });

        const categories = await Category.find({ isListed: true });

        res.render('products', {
            data: productsWithMainImage,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            cat: categories,
            search: search
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('admin/error-page');
    }
};

const blockProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found',
                type: 'error' 
            });
        }
        
        product.isBlocked = true;
        await product.save();
        
        res.json({ 
            success: true, 
            message: 'Product blocked successfully',
            type: 'success'
        });
    } catch (error) {
        console.error('Error blocking product:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error blocking product',
            type: 'error' 
        });
    }
};

const unblockProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found',
                type: 'error' 
            });
        }
        
        product.isBlocked = false;
        await product.save();
        
        res.json({ 
            success: true, 
            message: 'Product unblocked successfully',
            type: 'success'
        });
    } catch (error) {
        console.error('Error unblocking product:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error unblocking product',
            type: 'error' 
        });
    }
};





const deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findByIdAndDelete(productId);
        
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ success: false, error: 'Error deleting product' });
    }
};


     


const getEditProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({_id: id}).populate('category');
        const categories = await Category.find({}); // Change 'cat' to 'categories'
        
        // Create initial size-quantity pair from main product fields
        const mainSizeQuantity = {
            size: product.size,
            quantity: product.quantity
        };
        
        // Prepare the sizes array for the template
        let sizesArray = [mainSizeQuantity];
        
        // Add variant sizes if they exist
        if (product.variants && product.variants.length > 0) {
            sizesArray = [...sizesArray, ...product.variants[0].sizes];
        }
        
        res.render('editProduct', {
            product: product,
            categories: categories, // Changed from 'cat' to 'categories'
            sizesArray: sizesArray
        });
    } catch (error) {
        console.log(error);
        res.redirect('/admin/pageerror');
    }
}


const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;
        
        // Convert sizes and quantities to arrays if they're not already
        const sizes = Array.isArray(data.sizes) ? data.sizes : [data.sizes];
        const quantities = Array.isArray(data.quantities) ? data.quantities : [data.quantities];

        // The first size-quantity pair will be the main product size/quantity
        const mainSize = Number(sizes[0]);
        const mainQuantity = Number(quantities[0]);

        // Create size-quantity pairs for variants (excluding the first pair)
        const variantSizePairs = sizes.slice(1).map((size, index) => ({
            size: Number(size),
            quantity: Number(quantities[index + 1] || 0)
        })).filter(pair => pair.size && !isNaN(pair.quantity));

        // Get category
const category = await Category.findById(data.category);
if (!category) {
    return res.status(400).json({ error: 'Invalid category' });
}

        // Create update fields
        const updateFields = {
            productName: data.productName,
            description: data.description,
            category: category._id,
            regularPrice: data.regularPrice,
            salesPrice: data.salePrice,
            color: data.color,
            size: mainSize,
            quantity: mainQuantity
        };

        // Only add variants if there are additional sizes
        if (variantSizePairs.length > 0) {
            updateFields.variants = [{
                color: data.color,
                sizes: variantSizePairs,
                isListed: true
            }];
        }

        // Handle image uploads
        if (req.files && req.files.length > 0) {
            const newImages = await Promise.all(req.files.map(async file => {
                const filename = `${Date.now()}-${file.originalname}`;
                const outputPath = path.join('public', 'uploads', 'product-images', filename);
                
                await sharp(file.buffer)
                    .jpeg({ quality: 90 })
                    .toFile(outputPath);

                return filename;
            }));

            // Combine new images with existing ones
            const existingProduct = await Product.findById(id);
            updateFields.productImages = [...(existingProduct.productImages || []), ...newImages];
        }

        // Update the product
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            updateFields,
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ success: true, message: 'Product updated successfully' });

    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};




// const deleteSingleImage = async (req, res) => {
//     try {
//         const { imageNameToServer, productIdToServer } = req.body;

//         // Update product document to remove the image
//         await Product.findByIdAndUpdate(productIdToServer, { $pull: { productImages: imageNameToServer } });

//         const imagePath = path.join('public', 'uploads', 'product-images', imageNameToServer);
//         if (fs.existsSync(imagePath)) {
//             await fs.unlinkSync(imagePath);
//             console.log(`Image ${imageNameToServer} deleted successfully.`);
//         } else {
//             console.log(`Image ${imageNameToServer} not found.`);
//         }
        
//         res.send({ status: true });
        
//     } catch (error) {
//         console.error(error);
//         res.redirect('/pageerror');
//     }
// };







const productVariants = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send('Product not found');
        }

        const search = req.query.search || '';
        let variants = product.variants;

        if (search) {
            variants = variants.filter(variant => 
                variant.color.toLowerCase().includes(search.toLowerCase())
            );
        }

        const variantsCount = variants.length;
        const limit = 5;
        const totalPages = Math.ceil(variantsCount / limit);
        const currentPage = parseInt(req.query.page) || 1;
        const start = (currentPage - 1) * limit;
        const end = start + limit;
        const variantsToDisplay = variants.slice(start, end);

        res.render('add-varients', {
            product,
            variants: variantsToDisplay,
            totalPages,
            currentPage,
            search
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};



const colorVarients = async (req, res) => {
    try {
        console.log('Color variant controller accessed');
        const productId = req.params.id;
        console.log('Product ID:', productId);  // For debugging
        
        const product = await Product.findById(productId).populate('variants');
        
        if (!product) {
            console.log('Product not found for ID:', productId);  // For debugging
            return res.status(404).send('Product not found');
        }

        // Pagination for variants
        const variantsCount = product.variants.length; // Count of variants
        const limit = 5; // Number of variants to display per page
        const totalPages = Math.ceil(variantsCount / limit); // Total pages
        const currentPage = parseInt(req.query.page) || 1; // Current page from query parameters

        // Slice the variants for the current page
        const start = (currentPage - 1) * limit;
        const end = start + limit;
        const variantsToDisplay = product.variants.slice(start, end);

        console.log('Variants to display:', variantsToDisplay); // For debugging

        res.render('colorVarient', {
            product,
            variants: variantsToDisplay,
            totalPages,    // Pass totalPages to EJS
            currentPage,   // Pass currentPage to EJS
        });
    } catch (error) {
        console.error('Error in colorVariants:', error);
        res.redirect('/admin/pageerror');
    }
};
 



const addColorVariant = async (req, res) => {
    try {
        const productId = req.params.id;
        const { color, sizes, quantities } = req.body;

        if (!Array.isArray(sizes) || !Array.isArray(quantities) || sizes.length !== quantities.length) {
            return res.status(400).send("Invalid sizes or quantities format.");
        }

        const variantSizes = sizes.map((size, index) => ({
            size: parseInt(size),
            quantity: parseInt(quantities[index])
        }));

        // Process and save images
        const images = await Promise.all(req.files.map(async (file, index) => {
            const filename = `${Date.now()}-${index}-${file.originalname}`;
            const outputPath = path.join('public', 'uploads', 'product-images', filename);
            
            await sharp(file.buffer)
                .jpeg({ quality: 90 })
                .toFile(outputPath);
            
            return {
                filename,
                contentType: 'image/jpeg'
            };
        }));

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        const newVariant = {
            color,
            sizes: variantSizes,
            images,
            isListed: true,
            mainImage: product.variants.length === 0 // First variant is main
        };

        product.variants.push(newVariant);
        await product.save();
        
        res.redirect(`/admin/productVariants/${productId}`);
    } catch (error) {
        console.error('Error adding color variant:', error);
        res.status(500).send('Internal server error');
    }
};





const listVariant = async (req, res) => {
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

        variant.isListed = true; // Assuming you have an isListed field
        await product.save();
        res.status(200).json({ message: 'Variant listed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while listing the variant' });
    }
};



const unlistVariant = async (req, res) => {
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

        variant.isListed = false; // Assuming you have an isListed field
        await product.save();
        res.status(200).json({ message: 'Variant unlisted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while unlisting the variant' });
    }
};
  


const deleteVariant = async (req, res) => {
    try {
        const { productId, variantId } = req.params;

        // Find the product by ID
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Find the index of the variant to delete
        const variantIndex = product.variants.findIndex(variant => variant._id.toString() === variantId);

        if (variantIndex === -1) {
            return res.status(404).json({ message: 'Variant not found' });
        }

        // Remove the variant from the array
        product.variants.splice(variantIndex, 1);
        await product.save(); // Save the updated product

        res.status(200).json({ message: 'Variant deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while deleting the variant' });
    }
};





// Edit Color Variant
const editVariantForm = async (req, res) => {
    try {
        const variantId = req.params.id;
        
        // Find the product that contains the variant
        const product = await Product.findOne({ "variants._id": variantId });
        
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Get the specific variant
        const variant = product.variants.id(variantId);
        console.log('Variant in edit form:', JSON.stringify(variant, null, 2));

        
        if (!variant) {
            return res.status(404).send('Variant not found');
        }

        // Render the edit form with the product and variant data
        res.render('editVariant', { 
            product,
            variant,
            errorMessage: null
        });

    } catch (error) {
        console.error('Error in editVariantForm:', error);
        res.status(500).send('Server Error');
    }
};



// Update Color Variant
const updateVariant = async (req, res) => {
    try {
        const variantId = req.params.id;
        const { color, sizes, quantities } = req.body;

        // Find product containing the variant
        const product = await Product.findOne({ "variants._id": variantId });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Get the variant
        const variant = product.variants.id(variantId);
        if (!variant) {
            return res.status(404).json({
                success: false,
                message: 'Variant not found'
            });
        }

        // Ensure sizes and quantities are arrays
        const sizeArray = Array.isArray(sizes) ? sizes : [sizes];
        const quantityArray = Array.isArray(quantities) ? quantities : [quantities];

        // Validate input
        if (!sizeArray || !quantityArray || sizeArray.length !== quantityArray.length) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sizes or quantities format'
            });
        }

        // Validate and process sizes
        const processedSizes = [];
        const uniqueSizes = new Set();

        for (let i = 0; i < sizeArray.length; i++) {
            const size = parseInt(sizeArray[i]);
            const quantity = parseInt(quantityArray[i]);

            // Validate size and quantity
            if (isNaN(size) || isNaN(quantity) || quantity < 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid size or quantity at position ${i + 1}`
                });
            }

            // Check for duplicate sizes
            if (uniqueSizes.has(size)) {
                return res.status(400).json({
                    success: false,
                    message: `Duplicate size ${size} found`
                });
            }

            uniqueSizes.add(size);
            processedSizes.push({
                size: size,
                quantity: quantity
            });
        }

        // Update variant
        variant.color = color;
        variant.sizes = processedSizes;

        // Handle image updates if any are uploaded
        if (req.files && req.files.length > 0) {
            const images = await Promise.all(req.files.map(async (file, index) => {
                const filename = `${Date.now()}-${index}-${file.originalname}`;
                const outputPath = path.join('public', 'uploads', 'product-images', filename);
                
                await sharp(file.buffer)
                    .jpeg({ quality: 90 })
                    .toFile(outputPath);
                
                return {
                    filename,
                    contentType: 'image/jpeg'
                };
            }));

            // Update images if new ones are uploaded
            variant.images = images;
        }

        // Save the updated product
        await product.save();

        res.json({
            success: true,
            message: 'Variant updated successfully'
        });

    } catch (error) {
        console.error('Error updating variant:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating variant'
        });
    }
};
 
 

module.exports = {
    getProductAddPage, 
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    // deleteSingleImage,
    deleteProduct,
    productVariants,
    colorVarients,
    addColorVariant,
    listVariant,
    unlistVariant,
    deleteVariant,
    editVariantForm,
    updateVariant,
    


};
