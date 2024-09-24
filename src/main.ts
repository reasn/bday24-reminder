import { DateTime } from "luxon";
import pino from "pino";
import OpenAI from "openai";

import {
  fetchActiveMessages,
  fetchActiveRecipients,
  MessageRow,
  RecipientRow,
  updateRecipient,
} from "./sheet";
import { send } from "./sms";

const logger = pino();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export default async function main() {
  //   await updateRecipient(1, 1, "test message", "hallo Alex");
  logger.info("Preparing sendout");

  const recipients = await fetchActiveRecipients();
  const messages = await fetchActiveMessages();
  logger.info(
    `Fetched ${recipients.length} recipients and ${messages.length} messages`
  );

  for (const recipient of recipients) {
    const sendable = messages.find((m) => m.level > recipient.level);
    if (!sendable) {
      continue;
    }
    const content = await compile(sendable, recipient);
    logger.info(
      `${process.env.HOT === "true" ? "Sending" : "NOT sending"} level ${
        sendable.level
      } message to ${recipient.number}`
    );
    if (process.env.HOT) {
      await send(recipient.number, content);
    }
    logger.info(
      `Updating ${recipient.rowIndex} (${recipient.number}) to level ${sendable.level} with ${sendable.caption}`
    );
    await updateRecipient(
      recipient.rowIndex,
      sendable.level,
      sendable.caption,
      content
    );
  }
}

const compile = async (message: MessageRow, recipient: RecipientRow) => {
  const timeLeft = DateTime.fromISO("2024-12-07T11:00:00").diffNow();
  const valueMap = {
    name: recipient.name,
    days: Math.round(timeLeft.as("days")),
    seconds: Math.round(timeLeft.as("seconds")),
    hours: Math.round(timeLeft.as("hours")),
  };

  let templated = message.content;
  for (const key in valueMap) {
    templated = templated.replaceAll(`{${key}}`, valueMap[key]);
  }

  if (message.type === "template") {
    return templated;
  }

  const completion = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "system",
        content: [
          "respond with the content of a text message",
          "it's a reminder sms for a single party guest",
          "write in a funny over-the-top underwater style",
          "you never mention the guest's name more than once",
          "the text message length is limited to 300 characters",
        ].join(".\n"),
      },
      {
        role: "user",
        content: templated,
      },
    ],
    // model: "gpt-4o-2024-08-06",
    model: "gpt-3.5-turbo",
    //"gpt-4o-mini-2024-07-18",
    // temperature: 1.4,
  });

  if (!completion.choices[0].message.content) {
    logger.info(completion);
    throw new Error();
  }
  return completion.choices[0].message.content;
};
