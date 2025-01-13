

const checkOtpSession = (req, res, next) => {
    if (!req.session || !req.session.userData) {
        return res.status(400).json({
            success: false,
            message: "Session expired. Please sign up again."
        });
    }
    next();
};


module.exports= {
    checkOtpSession
}