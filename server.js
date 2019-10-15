var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require("path");

var Note = require(".models/Note.js");
var Article = require("./models/Article.js");

var axios = require("axios");
var cheerio = require("cheerio");

var PORT = process.env.PORT || 3000;

var app = express();

app.use(logger("dev"));
app.use(
  bodyParser.urlencoded({
    extended: false
  })
);

app.use(express.static("public"));

var exphbs = require("express-handlebars");

app.engine(
  "handlebars",
  exphbs({
    defaultLayout: "main",
    partialsDir: path.join(__dirname, "/views/layouts/partials")
  })
);
app.set("view engine", "handlebars");

mongoose.connect("mongodb://localhost/news-scraper");

app.get("/", function(req, res) {
  Article.find({ saved: false }, function(err, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("index", hbsObject);
  });
});

app.get("/saved", function(req, res) {
  Article.find({ saved: true })
    .populate("notes")
    .exec(function(error, articles) {
      var hbsObject = {
        article: articles
      };
      res.render("saved", hbsObject);
    });
});

app.get("/scrape", function(req, res) {
  axios.get("https://www.nytimes.com/section/us").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);
    $("div.story-body").each(function(i, element) {
      var result = {};
      result.title = $(element)
        .children("h2.headline")
        .text();
      result.link = $(element)
        .find("a")
        .attr("href");
      result.summary = $(element)
        .find("p.summary")
        .text();

      Article.create(result)
        .then(function(data) {
          console.log(data);
        })
        .catch(function(data) {
          return res.json(err);
        });
    });
    res.send("Scrape Complete");
  });
});

app.get("/clear", function(req, res) {
  db.Article.remove({ saved: false }, function(err, doc) {
    if (err) {
      console.log(err);
    } else {
      console.log("removed");
    }
  });
  res.redirect("/");
});

app.get("articles", function(req, res) {
  Article.find({}, function(err, data) {
    if (err) {
      console.log(err);
    } else {
      res.json(data);
    }
  });
});

app.get("/articles/:id", function(req, res) {
  Article.findOne({ _id: req.params.id })
    .populate("note")
    // ask a TA the difference betweeen exec and then
    .exec(function(err, data) {
      if (err) {
        console.log(err);
      } else {
        res.json(data);
      }
    });
});

app.post("/articles/save/:id", function(req, res) {
  Article.findOneAndUpdate({ _id: req.params.id }, { saved: true }).exec(
    function(err, data) {
      if (err) {
        console.log(err);
      } else {
        res.send(data);
      }
    }
  );
});

app.post("/articles/delete/:id", function(req, res) {
  //Anything not saved
  Article.findOneAndUpdate(
    { _id: req.params.id },
    { saved: false, notes: [] }
  ).exec(function(err, data) {
    // Log any errors
    if (err) {
      console.log(err);
    } else {
      res.send(data);
    }
  });
});

app.post("/notes/save/:id", function(req, res) {
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  console.log(req.body);
  newNote.save(function(err, note) {
    if (err) {
      console.log(err);
    } else {
      Article.findOneAndUpdate(
        { _id: req.params.id },
        { $push: { notes: note } }
      ).exec(function(err) {
        if (err) {
          console.log(err);
          res.send(err);
        } else {
          res.send(note);
        }
      });
    }
  });
});

app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
  //Anything not saved
  Article.findOneAndUpdate({ _id: req.params.note_id }, function(err) {
    if (err) {
      console.log(err);
      res.send(err);
    } else {
      Article.findOneAndUpdate(
        { _id: req.params.article_id },
        { $pull: { notes: req.params.note_id } }
      ).exec(function(err) {
        if (err) {
          console.log(err);
          res.send(err);
        } else {
          res.send("Note Deleted");
        }
      });
    }
  });
});

app.listen(PORT, function() {
  console.log("App running on port " + PORT);
});
