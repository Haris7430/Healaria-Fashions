
const User= require('../../models/userSchema');
const mongoose= require('mongoose');
const bcrypt= require('bcrypt');


const loadLogin= (req,res)=>{
    if(req.session.isAdmin){
        return res.redirect('/admin-dashboard');
    }
    res.render('admin-login',{error:null})
}


const login= async(req,res)=>{
    try{
        const {email,password}=req.body;
        const admin= await User.findOne({email,isAdmin:true});
        if(admin){
            const passwordMatch= await bcrypt.compare(password,admin.password);
            
            if(passwordMatch){
                req.session.isAdmin= true;
                return res.redirect('/admin/admin-dashboard')
            }else {
                console.log('admin password not match (const login-admin controller)');
                return res.redirect('/admin/admin-login')
                
            } 
        } else{
            console.log('user not admin (const login-admin controller)');
            return res.redirect('/admin/admin-login');
            
        }

    } catch(error){
        console.log('login error',error);
        return res.redirect('/pageerror');

    }
}


const loadDashboard= async(req,res)=>{
    if(req.session.isAdmin){
        try{
            res.render('admin-dashboard');
        } catch(error){
            res.redirect('/pageerror')
        }
    }
}


const pageerror= (req,res)=>{
    res.render('pageerror');
}


const logout= async(req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log('Error found destroying admin',err);
                return res.render('pageerror')
            }
            res.redirect('/admin/admin-login');
        })
    } catch (error) {
        console.log('unexpected error during logout admin',error);
        res.redirect('/pageerror')
    }
}


module.exports= {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout

}