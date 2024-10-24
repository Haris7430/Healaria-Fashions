const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
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
        res.redirect("/pageNotFound");
    }
}


const loadHomePage = async (req, res) => {
    try {
        const user= req.session.user;
        if(user){
         const userData= await User.findOne({_id:user._id});
         res.render("home",{user:userData})
        } else {
            return res.render('home')
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

            
            req.session.user = saveUserData._id;
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
    
};
 