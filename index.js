/**
 * If running on Nodejs 5.x and below, we load the transpiled code.
 * Otherwise, we use the ES6 code.
 * We are deprecating support for Node.js v5.x and below.
 */
const majorVersion = parseInt(process.versions.node.split('.')[0], 10);
if (majorVersion <= 5) {
  const deprecate = require('./src/utils').deprecate;
  deprecate('Node.js v5.x and below will no longer be supported in the future');
  module.exports = require('./lib/telegram');
} else {
  module.exports = require('./src/telegram');
}

const dotenv = require('dotenv');
dotenv.config();

const TOKEN = process.env.TELEGRAM_TOKEN;
const TelegramBot = require('node-telegram-bot-api');

const { PubSub } = require('@google-cloud/pubsub');
const pubSubClient = new PubSub();
const topicName = process.env.PUB_TOPIC; // Replace with your Pub/Sub topic name

const options = {
  polling: true
};
const bot = new TelegramBot(TOKEN, options);

async function publishMessage(text) {
  if (!text) {
    console.error('Cannot publish empty or undefined message');
    return;
  }

  const messageObject = {
    content: text // Set 'content' key to the incoming text
  };

  // Serialize to JSON and convert to Buffer
  const dataString = JSON.stringify(messageObject);
  const dataBuffer = Buffer.from(dataString);

  if (!dataBuffer.length) {
    console.error('Data buffer is empty, cannot publish');
    return;
  }

  // Further validate by attempting to parse the buffer back to JSON
  try {
    const testParse = JSON.parse(dataBuffer.toString());
    if (!testParse.content) {
      console.error('Validation failed: Content is empty.');
      return;
    }
  } catch (error) {
    console.error('Failed to parse data buffer back to JSON:', error);
    return;
  }
  try {
    const messageId = await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
    console.log(`Message ${messageId} published.`);
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
  }
}

bot.on('message', (msg) => {
  console.log(msg); // Log the message object to see what's coming in

  // Extract the text from the message
  const chatId = msg.chat.id;
  const text = msg.text && msg.text.trim();

  if (!text) {
    bot.sendMessage(chatId, 'You sent an empty message, which cannot be processed.');
    return;
  }

  // Send a reply back to the chat
  bot.sendMessage(chatId, `Received your message: ${text}`);

  // Publish the message text to Google Cloud Pub/Sub with the specified format
  publishMessage(text).catch(console.error);
});
