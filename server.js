
import dotenv from "dotenv";
dotenv.config()        // process.env
//const config = require('./config.js');
import path from 'path';
import express from 'express';
import bodyParser from "body-parser";
import cookieParser from 'cookie-parser';
import mongoose from"mongoose";
import cors from "cors";
import bcrypt from 'bcrypt';
import validUrl from 'valid-url';
import {nanoid} from 'nanoid';
import jwt from 'jsonwebtoken';

import nodemailer from 'nodemailer';//importing node mailer
import {google} from 'googleapis';
// import {OAuth2}  from  google.auth;
console.log('process.env',process.env.CLIENT_ID);
const CLIENT_ID = `${process.env.CLIENT_ID}`;
const CLIENT_SECRET = `${process.env.CLIENT_SECRET}`;
const REDIRECT_URI = `${process.env.REDIRECT_URI}`;
const REFRESH_TOKEN = `${process.env.REFRESH_TOKEN}`;

import ShortUrl from "./models/shortUrls.js";
import generateURLId from "./utils.js";

import RegisterUser from "./models/registerUser.js";
import UserPasswordReset from './models/userPasswordReset.js';
// const registerRoutes = require('./routes/register');

import loginRouter from './routes/login.js';
import registerRouter from './routes/register.js';

const app = express();

const corsOptions = {
  // origin : 'http://127.0.0.1:5500'
  origin: "*",
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(cookieParser());

const mongoURI = `${process.env.mongoURI}`;

const connectToMongoDb = async () => {
  try {
    const result = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    app.listen(process.env.PORT || 8585, "0.0.0.0");
    console.log(`Back end server running on ${process.env.PORT}`);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.log(err);
  }
};

connectToMongoDb();

app.post('/register', registerRouter);

app.post('/confirmEmailResetPassword', async (req, res) => { 
  
  if(req.body.username === undefined || req.body.username === ''){
    res.status(400).json({message: "Enter valid email ID"});
  } else{
    const user = await RegisterUser.findOne({ username: req.body.username});
    if(!user){
      return res.status(400).json({message: "User doesn't  exists"});
    } else {
      //As the user exists, 
      // Create a random 10 digit number and store it in the user document as an object with values {key: randomNumber, username: userEmail}
      const randomKey = nanoid(10).toLowerCase();
      const userPasswordResetObj = new UserPasswordReset({
          randomKey: randomKey,
          username: user.username,
          expirationDate: addMinutes(new Date(), 10)
      });
      
      await userPasswordResetObj.save();

      const resetPasswordLink = `${process.env.backEndUrl}/reset/${user.username}/${randomKey}`;
      console.log('resetPasswordLink',resetPasswordLink)
      // Create a link the reset/:email/:randomnumber route on the backend and send it to the user email using nodemailer 

      const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      oAuth2Client.setCredentials({refresh_token: REFRESH_TOKEN});
      const accessToken = await oAuth2Client.getAccessToken();

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: 'OAuth2',
          user: "ravikiransjce.code@gmail.com", //replace with your email
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          refreshToken: REFRESH_TOKEN,
          accessToken: accessToken
        },
        tls : { rejectUnauthorized: false }
      });

      const mailOptions = {
        from: "<ravikriansjce.code@gmail.com>", //replace with your email
        to: `${user.username}`, //replace with your email
        subject: `PASSWORD RESET`,
        html: `<p> Please click the link to reset your password or copy paste ${resetPasswordLink} in a browser window</p><br>
                <a href=${resetPasswordLink}></a>`,
      };

      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
          return res.json({message: "User doesn't  exists"}) // if error occurs send error as response to client
        }
        else {
          console.log('Email sent: ' + info.response);
          return res.json({message:"Sent Successfully"})//if mail is sent successfully send Sent successfully as response
        }
      });
     // return res.status(200).json({message: "Check your email for reset options"});
    }
  }  
});

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes*60000);
}

app.get('/reset/:username/:randomKey', async (req, res) => {
  console.log('req.params ',req.params);
  const result = await UserPasswordReset.find({username: req.params.username}).sort({createdAt: "desc"});
  console.log(result);
  const latestResetObj = result[0];
  if(latestResetObj.expirationDate > new Date()){
    res.status(302).redirect(`${process.env.frontEndUrl}/reset?username=${latestResetObj.username}&key=${latestResetObj.randomKey}`);
  } else {
    res.status(302).redirect(`${process.env.frontEndUrl}/confirmemail`);
  }
});

app.post('/reset', async (req, res) => {
  // req.body should have valid password, email and random number generated in the previous step
  console.log(req.body);
})

app.post('/resetPassword', async (req, res) => {
  const result = await UserPasswordReset.find({username: req.body.username}).sort({createdAt: "desc"});
  const latestResetObj = result[0];
  console.log(latestResetObj, req.body);
  if(latestResetObj.expirationDate > new Date()){
    const hash = await bcrypt.hash(req.body.password, 10);
    const dbResult = await RegisterUser.updateOne({username: latestResetObj.username}, {password: hash});
    res.json({message: "Password reset successfully", username: latestResetObj.username});
  } 
});

app.post('/login', loginRouter);

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1];
  console.log('token', token);
  if (token == null) return res.sendStatus(401) // if there isn't any token
  
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.sendStatus(403).redirect('/login.html');
    } else {
      console.log(payload);
      res.locals.username = payload.data;
      next() // pass the execution off to whatever request the client intended
    }
  })
}

app.get('/favicon.ico', (req, res) => {
  res.send();
});

// Route to show last few shortened urls along with original url and visit count
app.get('/recent/:username',authenticateToken, (req, res) => {
  const username = req.params.username; 
  if(username === undefined || req.body.username === ''){
    res.status(400).json({message: "Invalid credentials"});
  } else {
    ShortUrl.find({ username: username })
    .limit(5)
    .sort({ createdAt: "desc" })
    .then((result) => {
      res.json(result);
    })
    .catch((err) => console.log(err));
  }
});

app.get('/recentAll', authenticateToken, (req, res) => {
  ShortUrl.find()
    .limit(5)
    .sort({ createdAt: "desc" })
    .then((result) => {
      res.json(result);
    })
    .catch((err) => console.log(err));
})

// Route to show home page
app.get('/', (req, res) => {
  res.redirect(`${process.env.frontEndUrl}/login.html`);
});

app.post('/authenticateSession', (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1];
  console.log('token', token);
  if (token == null) return res.sendStatus(401) // if there isn't any token
  
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.sendStatus(403).redirect('/login.html');
    } else {
      console.log(payload);
      res.status(200).send({message: "OK"}); // pass the execution off to whatever request the client intended
    }
  })
});


