const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema')

const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);
        res.render('category', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        });
    } catch (error) {
        console.log(error);
        res.redirect('/pageerror');
    }
};

const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        // Check for existing category name
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        const newCategory = new Category({ name, description });
        await newCategory.save();
        res.status(200).json({ message: 'Category added successfully!' });
    } catch (error) {
        console.error("Error adding category:", error);
        res.status(500).json({ error: 'An error occurred while adding the category' });
    }
};

const getListCategory= async (req,res) => {
    try{
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect('/admin/category')
    } catch(error){
        console.log(error);
        res.redirect('/pageerror')
    }
}



const getUnlistCategory= async(req,res)=>{
    try{
        let id= req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.redirect('/admin/category')
    } catch(error){
        console.log(error);
        res.redirect('/pageerror')
    }
}


const getEditCategory= async(req,res)=>{
    try{
        const id = req.query.id;
        const category= await Category.findOne({_id:id});
        res.render('editCategory',{category:category})

    } catch(error){
        res.redirect('/pageerror/');
        console.log(error);
    }
}



const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { name, description } = req.body;

        // Validation
        if (!name || !description) {
            return res.status(400).json({ 
                error: 'Name and description are required' 
            });
        }

        if (!/^[a-zA-Z\s]+$/.test(name)) {
            return res.status(400).json({ 
                error: 'Category name should contain only alphabetic characters' 
            });
        }

        // Check if category name already exists (exclude the current one)
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') }, 
            _id: { $ne: id } 
        });
        
        if (existingCategory) {
            return res.status(400).json({ 
                error: 'Category name already exists' 
            });
        }

        // Update category
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            {
                name: name.trim(),
                description: description.trim(),
            },
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.status(200).json({ 
            message: 'Category updated successfully',
            category: updatedCategory 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};



const deleteCategory = async (req, res) => {
    try {
        const id = req.params.id;
        
        // Check if category is used in any products
        const products = await Product.find({ category: id });
        if (products.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category as it is associated with existing products' 
            });
        }

        const result = await Category.findByIdAndDelete(id);
        if (!result) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    deleteCategory,


};
