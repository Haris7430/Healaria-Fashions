

const User= require('../../models/userSchema');




const customerInfo = async (req, res) => {
    try {
        let search = '';
        if (req.query.search) {
            search = req.query.search;
        }

        let page = 1;
        if (req.query.page) {
            page = req.query.page;
        }

        const limit = 7;
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: '.*' + search + '.*', $options: 'i' } }, // Case-insensitive search
                { email: { $regex: '.*' + search + '.*', $options: 'i' } },
            ],
        })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: '.*' + search + '.*', $options: 'i' } },
                { email: { $regex: '.*' + search + '.*', $options: 'i' } },
            ],
        }).countDocuments();

        
        res.render('all-customers', {
            data: userData, 
            totalPages: Math.ceil(count / limit), 
            currentPage: page, 
            search: search, 
        });

    } catch (error) {
        console.log(error); 
        res.redirect("/pageerror");
    }
};



const customerBlocked= async(req,res)=>{
    try {

        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect('/admin/all-customers')
        
    } catch (error) {
        console.log(error);
        res.redirect('/pageerror');
    }
}



const customerunBlocked= async (req,res) => {
    try {
        
        let id= req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect('/admin/all-customers')

    } catch (error) {
        console.log(error);
        res.redirect('/pageerror')
    }
};

const deleteCustomer = async (req, res) => {
    try {
        const customerId = req.query.id;
        
        // Find and delete the customer by ID
        await User.findByIdAndDelete(customerId);

        // Redirect back to the customers page with a success message
        res.redirect('/admin/all-customers'); // Change this to the appropriate route
    } catch (error) {
        console.error("Error deleting customer:", error);
        res.redirect('/admin/all-customers');
    }
};



module.exports={
    customerInfo,
    customerBlocked,
    customerunBlocked,
    deleteCustomer,
}