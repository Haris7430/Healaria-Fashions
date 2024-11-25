const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    address: [{
        addressType: {
            type: String,
            required: true,
            enum: ['Home', 'Work', 'Other']
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true
        },
        city: { 
            type: String,
            required: [true, 'City is required'],
            trim: true
        },
        landmark: {
            type: String,
            required: [true, 'Landmark is required'],
            trim: true
        },
        state: {
            type: String,
            required: [true, 'State is required'],
            trim: true
        },
        pincode: {
            type: String,
            required: [true, 'Pincode is required'],
            match: [/^[0-9]{6}$/, 'Please enter a valid 6-digit pincode']
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            validate: {
                validator: function(v) {
                    return /^[1-9][0-9]{9}$/.test(v);
                },
                message: props => `${props.value} is not a valid phone number!`
            }
        },
        altPhone: {
            type: String,
            validate: {
                validator: function(v) {
                    return v === '' || /^[1-9][0-9]{9}$/.test(v);
                },
                message: props => `${props.value} is not a valid phone number!`
            }
        }
    }]
});

const Address = mongoose.model("Address", addressSchema);

module.exports = Address;