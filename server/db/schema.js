var Sequelize = require('sequelize');

// empty database should be created manually in mysql. MUST DO THIS FIRST
// server will create tables on first run, but empty DB needs to have been created
// this also assumes username is root without password
var sequelize = new Sequelize('test', 'root', null, {});
var Promise = require('bluebird');
var bcrypt = require('bcrypt-nodejs');

//create a Users table
var User = sequelize.define('users', {
  username: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  password: Sequelize.STRING
});

//collections table for user boards
var Collection = sequelize.define('collections', {
  title: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  }
});


//create a Bookmarks table
var Bookmark = sequelize.define('bookmarks', {
  title: Sequelize.STRING,
  url: {
    type: Sequelize.STRING,
    allowNull: false
  },
  baseUrl: {
    type: Sequelize.STRING,
    allowNull: false
  },
  snapshotUrl: Sequelize.STRING, //URL from server
  text: Sequelize.TEXT
});

//create Tags table:
//tags are single word descriptors that can be associated to each bookmarked page
var Tag = sequelize.define('tags', {
  tagName: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  }
});


//CREATE RELATIONS

//Bookmarks have one user, users have many bookmarks
User.hasMany(Bookmark);
Bookmark.belongsTo(User);

//Bookmarks have many tags, and tags have many bookmarks
Bookmark.belongsToMany(Tag, { through: "BookmarkTags" });
Tag.belongsToMany(Bookmark, { through: "BookmarkTags" });

//collection has many bookmarks, bookmarks can belong in different collections


//create the tables if they don't exist
sequelize.sync();

//////////////////////////////////////////
//HELPER FUNCTIONS FOR QUERYING DATABASE//
//////////////////////////////////////////

//check if user exists, and create a new user with a hashed password
exports.createUser = function(username, password, callback) {
  User.findAll({ where: { username: username } })
  .then(function(user) {
    console.log(user.length);
    if (user.length > 0) {
      callback("Username already taken");
    } else {
      bcrypt.hash(password, null, null, function(err, hash) {
        console.log(hash);
        User.create({ username: username, password: hash }).then(function(usr) {
          console.log(usr.dataValues.id);
          if (usr) {
            callback(null, usr.dataValues.id);
          } else {
            callback("Unable to create user.");
          }
        })
        .catch(function(err) {
          console.log('create: ' + err);
        });
      });
    }
  })
  .catch(function (err) {
    console.log('find: ' + err);
  });

};

//Check if user exists, check if password is correct, and pass a boolean to the callback
exports.authUser = function(user, password, callback) {
  User.findOne({ where: { username: user } })
  .then(function(user) {
    if (!user) {
      callback("Incorrect username or password.");
    } else {
      bcrypt.compare(password, user.password, function(err, passwordMatch) {
        if (err) {
          callback(err);
        } else {
          if (passwordMatch) {
            callback(null, user.id);
          } else {
            callback('wrong password');
          }
        }
      });
    }
  });
};

//check if bookmark exists, and create a new bookmark
exports.createBookmark = function(userId, title, url, snapshotUrl, baseUrl, text, callback) {
  Bookmark.findOrCreate({ where: { url: url }, defaults: {
    userId: userId,
    title: title,
    url: url,
    snapshotUrl: snapshotUrl,
    baseUrl: baseUrl,
    text: text
    }
  }).spread(function(bookmark, created) {
    if (created) {
      console.log('booookkkkkkkk: ', bookmark.dataValues.id)
      callback(null, bookmark.dataValues.id);
    } else {
      callback("You've already bookmarked this page.");
    }
  });
};

//get all bookmarks with a the logged in users ID
exports.getBookmarks = function(userId, callback) {
  Bookmark.findAll({ where: { userId: userId }, order: 'createdAt DESC' })
  .then(function(bookmarks) {
    if (bookmarks.length) {
      callback(null, bookmarks);
    } else {
      callback("We didn't find any bookmarks.");
    }
  });
};

//remove a bookmark with the given bookmark ID
exports.removeBookmark = function(bookmarkId, callback) {
  Bookmark.findOne({ where: { id: bookmarkId } })
  .then(function(bookmark) {
    if (!bookmark) {
      callback("Could not find bookmark.");
    } else {
      bookmark.destroy()
      .then(function() {
        callback();
      });
    }
  });
};


//get tagId from bookmarked site
exports.findTags = function() {

};

// Find recommendations for recently bookmarked site based on tagId
// Should re-factor this into a single mysql query
exports.findRecs = function(url, callback) {
  // Find bookmark id for the url we're passing in
  Bookmark.findOne({ where: { url: url }})
  .then(function (bookmark) {
    // Find the tagId of the current bookmark
    BookmarkTags.findOne({ where: { bookmarkId: bookmark.id }} )
    .then(function (bookmarkTag) {
      // Once we have the tagId, find a different bookmark with the same tag
      BookmarkTags.findOne({ where: { tagId: bookmarkTag.tagId }} )
      .then(function (newBookmarkTag) {
        // Now we have the id for our recommendation, so go back to bookmarks table and query it
        Bookmark.findOne({ where: { id: newBookmarkTag.bookmarkId }} )
        .then(function (recommendation) {
          // Return the recommendation as an argument of a callback function
          callback(recommendation);
        })
      })
    })
  })
};

//finds or creates a tag, and adds a join to the bookmark ID
exports.addTag = function(tagName, bookmarkId, callback) {
  console.log('adding tagggggg')
  Bookmark.findOne({ where: { id: bookmarkId } })
  .then(function(bookmark) {
    if (!bookmark) {
      console.log('bm not found');
      callback('bookmark not found');
    } else {
      Tag.findOrCreate({ where: { tagName: tagName } })
      .then(function(tag, created) {
        bookmark.addTag(tag[0]);
        callback(null, tag[0].id);
      });
    }
  });
};

//finds a tag and removes it from the join table
exports.removeTag = function(tagId, bookmarkId, callback) {
  var query = "DELETE FROM BookmarkTags WHERE bookmarkId = " + bookmarkId + " AND tagId = " + tagId + ";";

  sequelize.query(query).spread(function(results) {
    callback();
  });
};
