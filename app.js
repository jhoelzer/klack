const express = require("express");
const querystring = require("querystring");
const port = process.env.PORT || 3000;
const app = express();
const mongoose = require('mongoose');

const connectionString = process.env.CONNECTION_STRING || 'mongodb://localhost:27017/klack';

// Track last active times for each sender
let users = {};

app.use(express.static("./public"));
app.use(express.json());

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'Connection error with database:'));
db.once('open', function () {
  console.log("Connected successfully")
  
  const userSchema = new mongoose.Schema({
    user: String,
    lastActive: String
  })

  const messageSchema = new mongoose.Schema({
    sender: String,
    message: String,
    timestamp: Number
  })

  const Message = mongoose.model('Message', messageSchema);
  // const User = mongoose.model('User', userSchema);
  Message.find({}).then(messages => {
    messages.forEach(message => users[message.sender] = message.timestamp)
  })

  // generic comparison function for case-insensitive alphabetic sorting on the name field
  function userSortFn(a, b) {
    var nameA = a.name.toUpperCase(); // ignore upper and lowercase
    var nameB = b.name.toUpperCase(); // ignore upper and lowercase
    if (nameA < nameB) {
      return -1;
    }
    if (nameA > nameB) {
      return 1;
    }
    // names must be equal
    return 0;
  }

  app.get("/messages", (request, response) => {
    // get the current time
    const now = Date.now();

    // consider users active if they have connected (GET or POST) in last 15 seconds
    const requireActiveSince = now - 15 * 1000;

    // create a new list of users with a flag indicating whether they have been active recently
    let usersSimple = Object.keys(users).map(x => ({
      name: x,
      active: users[x] > requireActiveSince
    }));

    // sort the list of users alphabetically by name
    usersSimple.sort(userSortFn);

    // update the requesting user's last access time
    users[request.query.for] = now;

    // send the latest 40 messages and the full user list, annotated with active flags
    Message.find({}).then(messages =>
      response.send({
        messages: messages.slice(-40),
        users: usersSimple
      })).catch(err => console.log(err));
  });

  app.post("/messages", (request, response) => {
    // add a timestamp to each incoming message.
    const timestamp = Date.now();
    request.body.timestamp = timestamp;

    users[request.body.sender] = timestamp;

    Message.create({
        sender: request.body.sender,
        message: request.body.message,
        timestamp: request.body.timestamp
      },
      (err, newMessage) => {
        // Send back the successful response.
        if (err !== null) {
          response.status(500)
          response.send(err)
          return
        }
        response.status(201);
        response.send(request.body);

      })
  });

});

app.listen(port, () => {
  mongoose.connect(connectionString)
  // mongoose.connect(`mongodb://${DBUser}:${DBPassword}@${DBURI}/${DBName}`)
  console.log('Listening on port ' + port)
});