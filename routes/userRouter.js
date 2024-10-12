

const express=require('express');
const router=express.Router();
const usererController= require("../controllers/user/userController")


router.get("/pageNotFound",usererController.pageNotFound)
router.get('/',usererController.loadHomePage);



module.exports= router