//jshint esversion:6
require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const bsCustomFileInput = ('bs-custom-file-input');
const multer = require("multer");
const path = require("path");
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate');


const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: process.env.LOCAL_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:8080/restaurantsDB", {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useFindAndModify: false
});
mongoose.set("useCreateIndex", true);

//DB Schemas
// Menu DB
const menuSchema = new mongoose.Schema({
  restId: Number,
  image: String,
  name: String,
  desc: String,
  price: Number
});
const Menu = mongoose.model("Menu", menuSchema);
// Restaurant DB
const restSchema = new mongoose.Schema({
  restOwner_id: Number,
  logo: String,
  name: String,
  desc: String,
  menu: [menuSchema]
});
const Rest = mongoose.model("Rest", restSchema);
// User DB
const userSchema = new mongoose.Schema({
  googleId: String,
  facebookId: String,
  isRestOwner: Boolean,
  username: Array,
  email: String,
  pic: String,
  password: String,
  restaurants: [restSchema]
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

//Login Strategies
//Local
passport.use(User.createStrategy());
//Google
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/court",
    passReqToCallback: true,
  },
  function(request, accessToken, refreshToken, profile, done) {
    User.findOrCreate({
      googleId: profile.id
    }, {
      username: profile.displayName,
      email: profile.email,
      pic: profile.picture
    }, function(err, user) {
      return done(err, user);
    });
  }));
//Facebook
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets",
    passReqToCallback: true,
    profileFields: ['id', 'emails', 'name']
  },
  function(request, accessToken, refreshToken, profile, done) {

    User.findOrCreate({
        facebookId: profile.id
      }, {
        username: profile.name,
        email: profile.emails[0].value,
        pic: profile.picture
      },
      function(err, user) {
        return done(err, user);
      });
  }));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// Picture Storage file path
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/images/');
  },
  filename: function(req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
  }
});
// File check - only jpeg || png files
const fileFilter = function(req, file, cb) {
  if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png') {
    cb(null, true);
  } else {
    cb(null, false); // Send error codes here
  }
}
const upload = multer({
  storage: storage,
  fileFilter: fileFilter
});


// POST-GET from templates
//Home Page
app.get("/", function(req, res) {
  Rest.find({}, function(err, rests) {
    res.render("home", {
      rests: rests
    });
  });
});
//---Login and Registration
app.get("/login", function(req, res) {
  res.render("login");
});
app.get("/register", function(req, res) {
  res.render("register");
});
//OAuth routes
//---Google
app.get("/auth/google",
  passport.authenticate("google", {
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  }));

app.get("/auth/google/court",
  passport.authenticate("google", {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect to profile.
    res.redirect('/profile');
  });
//---Facebook
app.get("auth/facebook",
  passport.authenticate("facebook", {
    scope: ["public_profile", "emails"]
  }));

app.get("auth/facebook/court",
  passport.authenticate("facebook", {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect('/profile');
  });
//---Local`
app.post("/register", function(req, res) {

  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("profile");
      })
    }
  })
});

app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("profile");
      });
    }
  })
});

//---User profile
app.get("/profile/", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("profile", {
      user: req.user,
      rests: req.user.restaurants,
      rest: req.user.restaurants[0]
    });
  } else {
    res.redirect("login");
  }
});
//---Restaurant Info partials
app.get("/profile/:selectRestName", function(req, res) {
  let restSelect = req.params.selectRestName;
  Rest.findOne({
    name: restSelect
  }, function(err, rest) {
    if (!err) {
      res.render("profile", {
        user: req.user,
        rests: req.user.restaurants,
        rest: rest
      });
    }
  });
});
//---Restaurant register
app.get("/rest-register", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("rest-register");
  } else {
    res.redirect("login");
  }
});

app.post("/restData", upload.single('restLogo'), function(req, res, next) {

  rest = new Rest({
    logo: "images/" + req.file.filename,
    name: req.body.restName,
    desc: req.body.restDesc
  });
  //Add rest to user profile
  User.findById(req.user.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      foundUser.restaurants.push(rest);
      foundUser.save();
    }
  });
  //Save Restaurant to DB
  rest.save(function(err) {
    if (!err) {
      res.redirect("/menu-create");
    }
  });
});
//---Add items to menú
app.get("/menu-create", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("menu-create");
  } else {
    res.redirect("login");
  }
});

//---Restaurants Page
//-----Render
app.get("/rest/:selectRestName", function(req, res) {
  let restSelect = req.params.selectRestName;
  Rest.findOne({
    name: restSelect
  }, function(err, rest) {
    if (!err) {
      res.render("rest", {
        rest: rest
      });
    }
  });
});

//Server Listening
app.listen(port, function() {
  console.log("Server is running... Apparently ");
});