require("dotenv").config();
import request from "request";
import chatBotService from "../services/chatBotService";

const MY_VERIFY_TOKEN = process.env.MY_VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;


let postWebhook = (req, res) => {
  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);


      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }

    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

};


let getWebhook = (req, res) => {
  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = MY_VERIFY_TOKEN;

  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {

    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {

      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);

    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
};

// Handles messages events
function handleMessage(sender_psid, received_message) {
  //Handle text message
  let entity = handleMessageWithEntities(received_message);

  if (entity.name === "wit$datetime:datetime") {
    //handle quick reply message: asking about the incidence
    let response = { "text": "Please decribe the incidence. Start your description with 'Incidence: '" };
    await chatBotService.sendMessage(sender_psid, response);

  } else if (entity.name === "wit$phone_number:phone_number") {
    //handle quick reply message: done reserve table

  } else if (received_message.includes("Incidence:")) {
    // Create the payload for a basic text message
    let response = { "text": "Thank you for reporting the incidence. We will get back to you as soon as possible." };
    await chatBotService.sendMessage(sender_psid, response);

  } else {
    //default reply
  }

  //handle attachment message

}

//Use Facebook AI to read user message
let handleMessageWithEntities = (message) => {
  let entitiesArr = ["wit$datetime:datetime", "wit$phone_number:phone_number"];
  let entityChosen = "";
  let data = {}; //data is an object saving value and name of the entity
  entitiesArr.forEach((name) => {
    let entity = firstEntity(message.nlp, name);
    if (entity && entity.confidence > 0.8) {
      entityChosen = name;
      data.value = entity.value;
    }
  });

  data.name = entityChosen;
  return data;
};

function firstEntity(nlp, name) {
  return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
};


// Handles messaging_postbacks events
let handlePostback = async (sender_psid, received_postback) => {
  let response;

  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  switch (payload) {
    case "GET_STARTED": //Message user receive after clicking on "Get Started"
      //get username
      let username = await chatBotService.getFacebookUsername(sender_psid);
      await chatBotService.sendResponseWelcomeNewCustomer(username, sender_psid);

      //response = { "text": `Welcome ${username} to Police Help! ` };
      break;
    case "EMERGENCY":
      response = {};
      break;
    case "REPORT_INCIDENCE":
      await chatBotService.reportIncidence(sender_psid);
      break;
    default:
      console.log("Something wrong with switch case payload");
  }
  // Send the message to acknowledge the postback
  //callSendAPI(sender_psid, response);
};

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  };

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v6.0/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}


module.exports = {
  postWebhook: postWebhook,
  getWebhook: getWebhook
};