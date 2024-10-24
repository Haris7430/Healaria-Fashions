

const  express= require('express');
const app= express();
const path= require('path')
const env= require('dotenv').config()
const passport= require("./config/passport")
const session= require('express-session')
const db=require('./config/db');
const adminRouter= require('./routes/adminRouter')
const userRouter= require('./routes/userRouter');
db()


app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
maxAge:72*60*60*1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});



app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next()
}) 

 
app.set('view engine','ejs')
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);


app.use(express.static(path.join(__dirname,'public/user')));

app.use('/dashboard-assets',express.static(path.join(__dirname,'/public/dashboard-assets')));

app.use('/',userRouter) 
app.use('/admin',adminRouter);
       

app.listen(process.env.PORT, ()=> {
    console.log(`server running http://localhost:${process.env.PORT}`);
}) 
 
  
module.exports= app       