const User = require('../../models/userSchema'); // User schema
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const mongoose = require('mongoose');

const bcrypt = require('bcrypt'); 


const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id);
        const section = req.params.section; // e.g., 'profile', 'orders', 'addresses'
        
        let data = [];
        if (section === 'orders') {
            data = await Order.find({ userId: user._id });
        } else if (section === 'addresses') {
            data = user.addresses;
        }
        
        // Render the profile page with activeSection and data
        res.render('userProfile', {
            user,
            activeSection: section || 'profile', // Default to 'profile' if no section is provided
            data
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};



const getAddressPage = async (req, res) => {
    try {
        // Fetch address document for the logged-in user
        const address = await Address.findOne({ userId: req.user._id });

        res.render('userProfile', {
            user: req.user,
            activeSection: 'addresses',
            address: address || { address: [] } // Provide empty array if no addresses found
        });
    } catch (error) {
        console.error("Error fetching addresses:", error);
        res.status(500).render('error', { message: 'Error fetching addresses' });
    }
};




const getAddAddress = (req, res) => {
    res.render('userProfile', { 
        user: req.user, 
        activeSection: 'add-address',
        data: []
    });
};




const addAddress = async (req, res) => {
    try {
        const { name, addressType, phone, altPhone, landmark, city, state, pincode } = req.body;

        // Validate required fields
        if (!name || !addressType || !phone || !landmark || !city || !state || !pincode) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled' });
        }

        // Find existing address document for user or create new one
        let userAddress = await Address.findOne({ userId: req.user._id });

        if (!userAddress) {
            // If no address document exists for user, create new one
            userAddress = new Address({
                userId: req.user._id,
                address: [] // Initialize empty address array
            });
        }

        // Create new address object
        const newAddress = {
            name,
            addressType,
            phone,
            altPhone: altPhone || '',
            landmark,
            city,
            state,
            pincode
        };

        // Add new address to array
        userAddress.address.push(newAddress);

        // Save the document
        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: 'Address added successfully',
            redirectUrl: '/profile/addresses'
        });

    } catch (error) {
        console.error('Error adding address:', error);
        return res.status(500).json({
            success: false,
            message: 'Error adding address',
            error: error.message
        });
    }
};



const getAddressById = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.user._id;

        console.log('Fetching address:', { addressId, userId }); // Debug log

        const userAddress = await Address.findOne({ userId });

        if (!userAddress || !userAddress.address) {
            console.log('No addresses found for user:', userId); // Debug log
            return res.status(404).json({
                success: false,
                message: 'No addresses found for this user'
            });
        }

        const address = userAddress.address.find(addr => 
            addr._id.toString() === addressId
        );

        console.log('Found address:', address); // Debug log

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        return res.status(200).json({
            success: true,
            address
        });
    } catch (error) {
        console.error('Error fetching address:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching address details',
            error: error.message
        });
    }
};




// Update Address Controller
const updateAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.user._id;
        const updatedData = req.body;

        // Validate the updated data
        if (!updatedData.name || !updatedData.phone || !updatedData.addressType || 
            !updatedData.landmark || !updatedData.city || !updatedData.state || !updatedData.pincode) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // First find the user's address document
        const userAddress = await Address.findOne({ userId });

        if (!userAddress) {
            return res.status(404).json({
                success: false,
                message: 'No addresses found for this user'
            });
        }

        // Find the specific address in the array
        const addressIndex = userAddress.address.findIndex(
            addr => addr._id.toString() === addressId
        );

        if (addressIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Update the specific address
        userAddress.address[addressIndex] = {
            ...userAddress.address[addressIndex].toObject(),
            ...updatedData,
            _id: userAddress.address[addressIndex]._id // Preserve the original _id
        };

        // Save the updated document
        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: 'Address updated successfully'
        });

    } catch (error) {
        console.error('Error updating address:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating address',
            error: error.message
        });
    }
};


// Add this to your profile routes in `adminRouter.js`
const deleteAddress = async (req, res) => {
    const addressId = req.params.id;

    try {
        // Find the address document for the user
        const userAddress = await Address.findOne({ userId: req.user._id });
        
        if (!userAddress) {
            return res.status(404).json({ 
                success: false, 
                message: 'No addresses found for this user' 
            });
        }

        // Find and remove the specific address from the array
        const addressIndex = userAddress.address.findIndex(
            addr => addr._id.toString() === addressId
        );

        if (addressIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Address not found' 
            });
        }

        // Remove the address from the array
        userAddress.address.splice(addressIndex, 1);

        // Save the updated document
        await userAddress.save();

        res.json({ 
            success: true, 
            message: 'Address deleted successfully' 
        });
    } catch (err) {
        console.error('Delete address error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting address' 
        });
    }
};




const getDashboard = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const address = await Address.findOne({ userId: req.user._id });
        
        res.render('userProfile', {
            user,
            activeSection: 'profile',
            address: address || { address: [] }
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
};




const getEditProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.render('userProfile', {
            user,
            activeSection: 'edit-profile'
        });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
};

const updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;
        
        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Name is required'
            });
        }

        // Update user profile without email
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { name, phone },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
};





const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validate passwords
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match'
            });
        }

        // Get user and verify current password
        const user = await User.findById(req.user._id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password and update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message
        });
    }
};







const getUserOrders = async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .populate({
                path: 'items.productId',
                select: 'productName productImages'
            });

            res.render('userProfile', {
                activeSection: 'orders',
                orders,
                user: req.user
            });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('page-404', { 
            message: 'Error fetching orders',
            error: error.message 
        });
    }
};

const getOrderDetails = async (req, res) => {
    try {
      const { orderId } = req.params;
  
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).render('page-404', { message: 'Invalid order ID' });
      }
  
      const order = await Order.findOne({ _id: orderId, userId: req.user._id }).populate({
        path: 'items.productId',
        select: 'productName productImages salesPrice variants',
      });
  
      if (!order) {
        return res.status(404).render('page-404', { message: 'Order not found' });
      }
  
      const orderItems = order.items.map((item) => ({
        ...item.toObject(),
        product: {
          ...item.productId.toObject(),
          productImages: item.productId.productImages || [],
          variantImages: item.productId.variants?.[0]?.images || [],
        },
      }));
  
      res.render('orderSummary', { order, orderItems, user: req.user });
    } catch (error) {
      console.error('Error fetching order details:', error);
      res.status(500).render('page-404', { message: 'Error fetching order details', error: error.message });
    }
  };


  


module.exports = {
    getUserProfile,
    getAddressPage,
    getAddAddress,
    addAddress,
    
    getAddressById,
    updateAddress,
    deleteAddress,
    getDashboard,
    getEditProfile,
    updateProfile,
    
    changePassword,
    getUserOrders,
    getOrderDetails,


};
