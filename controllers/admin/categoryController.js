const Category = require('../../models/categorySchema');

const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
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

        // Check if category name already exists (exclude the current one)
        const existingCategory = await Category.findOne({ name, _id: { $ne: id } });
        if (existingCategory) {
            return res.status(400).render('editCategory', { error: 'Category already exists', category: { _id: id, name, description } });
        }

        // Update category
        const updatedCategory = await Category.findByIdAndUpdate(id, {
            name: name,
            description: description,
        }, { new: true });

        if (updatedCategory) {
            // Redirect to the categories page
            return res.redirect('/admin/category');
        } else {
            return res.status(404).render('editCategory', { error: 'Category not found', category: { _id: id, name, description } });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).render('editCategory', { error: 'Internal server error', category: { _id: req.params.id, name: req.body.name, description: req.body.description } });
    }
};




module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,


};
