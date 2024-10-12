

const pageNotFound= async (req,res) => {
    try{
        res.render("page-404")
    } catch (error){
        res.redirect("/pageNotFount")
    }
}

const loadHomePage= async (req,res)=>{
    try {
        return res.render('home')
    } catch (error) {
        console.log('Home Page Not Found',error);
        res.status(500).send('Server Error Home Page Note Found')
    }
}

module.exports={

    loadHomePage,
    pageNotFound

}