const express=require('express')
const mongoose=require('mongoose')
const path = require('path')
const bodyParser = require('body-parser')
const User=require('./models/user')
const passport=require('passport')
const LocalStrategy = require('passport-local')
const passportLocalMongoose=require('passport-local-mongoose')
const expressSession = require('express-session')
const FileType=require('file-type')
const blogsContent = require('./api/blog')


//fetching models
const Symptom=require('./models/symptom')
const Allergy=require('./models/allergy')
const Medication=require('./models/medication')
const Immune=require('./models/immune')
const Hospital=require('./models/hospital')
const Activity=require('./models/activity')
const Feedback=require('./models/feedback')
const { runInNewContext } = require('vm')

//fetching middlewares
const upload=require('./middlewares/fileupload')
const auth=require('./middlewares/auth')
const doctorAuth=require('./middlewares/doctorAuth')

const app=express()
mongoose.connect("mongodb+srv://adityabhagat:zxcvbnm123@cluster0.fmtmxer.mongodb.net/?retryWrites=true&w=majority",{useNewUrlParser:true,useCreateIndex:true,useUnifiedTopology:true,useFindAndModify:false})

// setup paths for directories
const publicDirPath= path.join(__dirname,'../public')
const viewsDirPath=path.join(__dirname,'../templates/views')
const partialsPath=path.join(__dirname,'../templates/partials')

//setup ejs and views directory
app.set('view engine', 'ejs')
app.set('views',viewsDirPath)

//setup static directory to serve
app.use(express.static(publicDirPath))
app.use(express.static(path.join(__dirname,'../node_modules')))

app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({
    extended: true
  })); 

//setting auth
app.use(expressSession({
    secret:"health-e-locker",
    resave:false,
    saveUninitialized:false
}))
app.use(passport.initialize())
app.use(passport.session())
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())
passport.use(new LocalStrategy(User.authenticate()));

// get home page
app.get('/home',(req,res)=>{
    res.render('index')
})
app.get('',(req,res)=>{
    res.render('index')
})


// get doctor dashboard
app.get('/doctor-dashboard', (req, res) => {
  if (req.user) {
    if (req.user.userType == 1) {
      res.render('doctor-dashboard');
    } else {
      res.redirect('/dashboard');
    }
  } else {
    res.redirect('/login');
  }
});

// Post sendOtp
app.post('/sendOtp', (req, res) => {
  const patientId = req.body.patientId;
  const otp = Math.floor(100000 + Math.random() * 900000); // generate OTP
  
  User.findOneAndUpdate(
    { username: patientId },
    { OTP: otp },
    { new: true },
    (err, doc) => {
      if (err) {
        console.log('Error updating OTP:', err);
        res.send('Error updating OTP');
      } else {
        const phone = doc.phone;
        // Code to send OTP to SMS
        // Require the Twilio module and create a client

        const accountSid = 'AC3b06ef5d6c346d3b2b0795a5ee715133';
        const authToken = 'b683cc6881d98551716108e8ea210a8f';
        const client = require('twilio')(accountSid, authToken);
        client.messages
            .create({
                body: 'Your Medi-Locker Authorization OTP is: ' + otp +'. '+'Share this OTP with '+req.user.username+' to give them permission to view your medical documents.',
                from: '+13203772583',
                to: '+91'+phone
            })
            .then(message => console.log(message.sid))
            .catch(error => console.error(error));
            res.send('OTP Sent to the Registered Phone Number');
            }
            }
        );
        });

// Post verifyOtp
app.post('/verifyOtp', function(req, res) {
  const { otp } = req.body;
  const {patientId} = req.body;
  // find the user in the database by username
  User.findOne({ username: patientId }, function(err, patient) {
    if (err) {
      console.error(err);
      return res.status(500).send('Internal server error');
    }

    if (!patient) {
      return res.status(401).send('Unauthorized');
    }

    // compare the OTP with the one stored in the database
    if (otp == patient.OTP) {
      const doctorId = req.user.username;
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      User.updateOne({ username: patientId }, { $set: { doctorAccess: doctorId, OTP: randomNum} }, function(err, result) {
        if (err) {
          console.error(err);
          return res.status(500).send('Internal server error');
        }
        return res.status(200).send('OTP verification successful');
      });
    } else {
      return res.status(401).send('Invalid OTP');
    }
    
  });
});




// get signup page
app.get('/signup',(req,res)=>{
    res.render('signup')
})

//post signup page

app.post('/signup',(req,res)=>{
    try{
        User.register({userType: req.body.userType, username:req.body.username,email: req.body.email, phone: req.body.phone, OTP: "", doctorAccess: ""},req.body.password,(err,user)=>{
            if(err){
                console.log(err)
                res.redirect('/signup')
            }
            passport.authenticate("local")(req,res,()=>{

                if(req.body.userType == 1){
        res.redirect('/doctor-dashboard')
    }else{
        res.redirect('/dashboard')
        
    }
    
               
            })
        })
    } catch (e) {
        res.status(500).send()
    }
})



//get login page
app.get('/login',(req,res)=>{
    res.render('login')
})

//post login
app.post('/login',passport.authenticate('local',{successRedirect: '/doctor-dashboard',failureRedirect:'/signup'}),(req,res)=>{})

//get logout
app.get('/logout',(req,res)=>{
    req.logout()
    res.redirect('/login')
})

//get dashboard
app.get('/dashboard',auth,(req,res)=>{
    res.render('dashboard',{username:req.user.username})
})

// symptom

app.get('/addSymptom',auth,(req,res)=>{
    res.render('addSymptom')
})

app.post('/addSymptom',auth,upload.single('file'),async (req,res)=>{
    try{
        if(req.file==undefined){
            const symptom=new Symptom({
                owner:req.user._id,
                symptom:req.body.symptom,
                dateOccurred:req.body.date,
                severity:req.body.severity,
                duration:req.body.duration,
                note:req.body.note,
                context:req.body.context
            })
            await symptom.save()
        } else {
            const symptom=new Symptom({
                owner:req.user._id,
                symptom:req.body.symptom,
                dateOccurred:req.body.date,
                severity:req.body.severity,
                duration:req.body.duration,
                note:req.body.note,
                doc:req.file.buffer,
                context:req.body.context
            })
            await symptom.save()
        }
        res.redirect('/alldoc')
    } catch (e) {
        console.log(e)
        res.redirect('/addSymptom')
    }
})

// allergy
app.get('/addAllergy',auth,(req,res)=>{
    res.render('addAllergy')
})

app.post('/addAllergy',auth,upload.single('file'),async (req,res)=>{
    try{
        if(req.file==undefined){
            const allergy=new Allergy({
                owner:req.user._id,
                allergen:req.body.allergen,
                reactions:req.body.reactions,
                dateidentified:req.body.dateidenty,
                severity:req.body.severity,
                note: req.body.note,
            })
            await allergy.save()
        } else {
            const allergy=new Allergy({
                owner:req.user._id,
                allergen:req.body.allergen,
                reactions:req.body.reactions,
                dateidentified:req.body.dateidenty,
                severity:req.body.severity,
                note: req.body.note,
                doc:req.file.buffer
            })
            await allergy.save()
        }
        res.redirect('/alldoc')
    } catch(e){
        console.log(e)
        res.redirect('/addAllergy')
    }
})


// Medicine
app.get('/addMedication',auth,(req,res)=>{
    res.render('addMedication')
})

app.post('/addMedication',auth,upload.single('file'),async (req,res)=>{
    try{
        if(req.file==undefined){
            const med=new Medication({
                owner:req.user._id,
                medicine:req.body.med,
                doseInfo:req.body.dose,
                reason: req.body.reason,
                prescribedDate:req.body.datep,
                prescribedEndDate:req.body.datef,
                note: req.body.note,
            })
            await med.save()   
        } else {
            const med=new Medication({
                owner:req.user._id,
                medicine:req.body.med,
                doseInfo:req.body.dose,
                reason: req.body.reason,
                prescribedDate:req.body.datep,
                prescribedEndDate:req.body.datef,
                note: req.body.note,
                doc:req.file.buffer
            })
            await med.save()
        }
        res.redirect('/alldoc')
    } catch(e){
        console.log(e)
        res.redirect('/addMedication')
    }
})

// immunisation
app.get('/addImmu',auth,(req,res)=>{
    res.render('addImmu')
})

app.post('/addImmu',auth,upload.single('file'),async (req,res)=>{
    try{
        if(req.file==undefined){
            const immu=new Immune({
                owner:req.user._id,
                vaccine:req.body.vaccine,
                protectionagainst:req.body.protection,
                dateTaken: req.body.date,
                note: req.body.note,
            })
            await immu.save()
        } else {
            const immu=new Immune({
                owner:req.user._id,
                vaccine:req.body.vaccine,
                protectionagainst:req.body.protection,
                dateTaken: req.body.date,
                note: req.body.note,
                doc:req.file.buffer
            })
            await immu.save()    
        }
        res.redirect('/alldoc')
    } catch(e){
        console.log(e)
        res.redirect('/addImmu')
    }
})

//hospital
app.get('/addHospital',auth,(req,res)=>{
    res.render('addHospital')
})

app.post('/addHospital',auth,upload.single('file'),async (req,res)=>{
    try{
        if(req.file==undefined){
            const hosp=new Hospital({
                owner:req.user._id,
                hospitalName:req.body.hospital,
                reason:req.body.reason,
                admissionDate: req.body.dateadmis,
                dischargeDate:req.body.datedischarge,
                note:req.body.note,
            })
            await hosp.save()
        } else {
            const hosp=new Hospital({
                owner:req.user._id,
                hospitalName:req.body.hospital,
                reason:req.body.reason,
                admissionDate: req.body.dateadmis,
                dischargeDate:req.body.datedischarge,
                note:req.body.note,
                doc:req.file.buffer
            })
            await hosp.save()
        }
        res.redirect('/alldoc')
    } catch(e){
        console.log(e)
        res.redirect('/addHospital')
    }
})

// ativities
app.get('/activities',auth,async (req,res)=>{
    try{
        await req.user.populate({
            path:'activities',
            options:{
                limit:10,
                sort:{
                    createdAt:-1
                }
            }
        }).execPopulate()
        res.render('activities/activities',{activities:req.user.activities})
    } catch(e){
        res.redirect('/dashboard')
    }
    
})

app.get('/newActivity',auth,(req,res)=>{
    res.render('activities/newactivity')
})

app.post('/newActivity',auth,async (req,res)=>{
    try{
        const activity=new Activity({
            owner:req.user._id,
            activityType:req.body.inputactivity,
            startDate:req.body.inputStartDate,
            startTime: req.body.inputStartTime,
            note: req.body.note,
            duration:req.body.duration
        })
        await activity.save()
        res.redirect('/activities')
    } catch(e){
        console.log(e)
        res.redirect('/newActivity')
        console.log('ERROR:' + e)
    }
})


//All Doc
app.get('/alldoc',auth,async (req,res)=>{
    try{
        await req.user.populate({
            path:'allergies',
            options:{
                limit:10,
                sort:{
                    createdAt:-1
                }
            }
        }).execPopulate()
        await req.user.populate({
            path:'hospitals',
            options:{
                limit:10,
                sort:{
                    createdAt:-1
                }
            }
        }).execPopulate()
        await req.user.populate({
            path:'symptoms',
            options:{
                limit:10,
                sort:{
                    createdAt:-1
                }
            }
        }).execPopulate()
        await req.user.populate({
            path:'medications',
            options:{
                limit:10,
                sort:{
                    createdAt:-1
                }
            }
        }).execPopulate()
        await req.user.populate({
            path:'immunisations',
            options:{
                limit:10,
                sort:{
                    createdAt:-1
                }
            }
        }).execPopulate()
        res.render('Alldoc',{allergies:req.user.allergies,symptoms:req.user.symptoms,hospitals:req.user.hospitals,immunisations:req.user.immunisations,medications:req.user.medications})
    } catch (e) {
        res.redirect('/dashboard')
    }
})

// get viewPatientData
app.get('/viewPatientData/:patientId', async (req, res) => {
  const patientId = req.params.patientId;
if(doctorAuth(patientId)){
  try {
    const patient = await User.findOne({username: patientId})
      .populate('allergies', null, null, { limit: 10, sort: { createdAt: -1 } })
      .populate('hospitals', null, null, { limit: 10, sort: { createdAt: -1 } })
      .populate('symptoms', null, null, { limit: 10, sort: { createdAt: -1 } })
      .populate('medications', null, null, { limit: 10, sort: { createdAt: -1 } })
      .populate('immunisations', null, null, { limit: 10, sort: { createdAt: -1 } });

    res.render('ViewPatientData', { patientId: patientId, allergies: patient.allergies, symptoms: patient.symptoms, hospitals: patient.hospitals, immunisations: patient.immunisations, medications: patient.medications });
  } catch (e) {
    console.log(e);
    res.redirect('/dashboard');
  }}else{return doctorAuth(patientId);}
});


// file serving to doctor
app.get('/viewPatientData/:patiendId/:model/:id',async (req,res)=>{
     const patientId = req.params.patientId;
    if(doctorAuth(patientId)){
    const model=req.params.model
    var document
    if(model==='Allergy'){
        document=await Allergy.findById(req.params.id)
    } else if(model==='Hospital'){
        document=await Hospital.findById(req.params.id)
    } else if(model==='Immune'){
        document=await Immune.findById(req.params.id)
    } else if(model==='Symptom'){
        document=await Symptom.findById(req.params.id)
    } else if(model==='Medication'){
        document=await Medication.findById(req.params.id)
    }
    const type=await FileType.fromBuffer(document.doc)
    if(type.ext=='pdf'){
        res.set('Content-type','application/pdf')
    } else if(type.ext=='jpeg'){
        res.set('Content-type','image/jpeg')
    } else if(type.ext=='jpg'){
        res.set('Content-type','image/jpg')
    }else{
        res.set('Content-type','image/png')
    }
    res.send(document.doc)}
    else{return doctorAuth(patiendId);}
})



// file serving
app.get('/alldoc/:model/:id',auth,async (req,res)=>{
    const model=req.params.model
    var document
    if(model==='Allergy'){
        document=await Allergy.findById(req.params.id)
    } else if(model==='Hospital'){
        document=await Hospital.findById(req.params.id)
    } else if(model==='Immune'){
        document=await Immune.findById(req.params.id)
    } else if(model==='Symptom'){
        document=await Symptom.findById(req.params.id)
    } else if(model==='Medication'){
        document=await Medication.findById(req.params.id)
    }
    const type=await FileType.fromBuffer(document.doc)
    if(type.ext=='pdf'){
        res.set('Content-type','application/pdf')
    } else if(type.ext=='jpeg'){
        res.set('Content-type','image/jpeg')
    } else if(type.ext=='jpg'){
        res.set('Content-type','image/jpg')
    }else{
        res.set('Content-type','image/png')
    }
    res.send(document.doc)
})


app.listen(3000,()=>{
    console.log('Server started')
})