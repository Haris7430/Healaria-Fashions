const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
require("dotenv").config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://healariafashions.shop/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
    try {
        // First check if user exists with the same email
        let user = await User.findOne({ email: profile.emails[0].value });
        
        if (user && !user.googleId) {
            // User exists but didn't sign up with Google
            return done(null, false, { 
                message: 'An account with this email already exists. Please login with your password.' 
            });
        }
        
        // Check for Google ID
        user = await User.findOne({ googleId: profile.id });
        
        if (user) {
            return done(null, user);
        } else {
            // Create new user
            const newUser = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                referralCode: generateReferralCode(),
                redeemed: false
            });
            await newUser.save();
            return done(null, newUser);
        }
    } catch (error) {
        return done(error, null);
    }
}));

// Helper function to generate referral code
function generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;