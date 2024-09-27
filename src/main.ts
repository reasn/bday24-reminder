import { DateTime } from "luxon";
import pino from "pino";
import OpenAI from "openai";

import {
  CommonPromptSet,
  fetchActiveMessages,
  fetchActiveRecipients,
  fetchCommonPrompts,
  MessageRow,
  RecipientRow,
  updateRecipient,
} from "./sheet";
import { send } from "./sms";

const logger = pino();

export default async function main() {
  const openAi = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  //   await updateRecipient(1, 1, "test message", "hallo Alex");
  logger.info("Preparing sendout");
  const now = DateTime.now();

  const prompts = await fetchCommonPrompts();
  const recipients = await fetchActiveRecipients();
  const messages = await fetchActiveMessages();
  logger.info(
    `Fetched ${recipients.length} recipients and ${messages.length} messages`
  );

  for (const recipient of recipients) {
    const sendable = messages.find(
      (m) => /*m.sendAfter >= now &&*/ m.wave > recipient.lastWave
    );
    if (!sendable) {
      logger.info(`Nothing to sent to ${recipient.name} (${recipient.number})`);
      continue;
    }
    const content = await compile(sendable, recipient, prompts, openAi);
    logger.info(
      `${
        process.env.HOT === "true" ? "Sending" : "NOT sending"
      } message (${now.toISO()}) to ${recipient.number}`
    );
    if (process.env.HOT) {
      await send(recipient.number, content);
    }
    logger.info(
      `Updating ${recipient.rowIndex} (${
        recipient.number
      }) to ${now.toISO()} with ${sendable.caption}`
    );
    await updateRecipient(
      recipient.rowIndex,
      sendable.wave,
      sendable.caption,
      content
    );
  }
}

const compile = async (
  message: MessageRow,
  recipient: RecipientRow,
  prompts: CommonPromptSet,
  openAi: OpenAI
) => {
  const timeLeft = DateTime.fromISO("2024-12-07T11:00:00").diffNow();
  const valueMap = {
    name: recipient.name,
    days: Math.round(timeLeft.as("days")),
    seconds: Math.round(timeLeft.as("seconds")),
    hours: Math.round(timeLeft.as("hours")),
  };

  let templated =
    message.type === "reminder" ? prompts.reminder : message.content;

  for (const key in valueMap) {
    templated = templated.replaceAll(`{${key}}`, valueMap[key]);
  }

  if (message.type === "template") {
    return templated;
  }

  const completion = await openAi.beta.chat.completions.parse({
    messages: [
      {
        role: "system",
        content: prompts.system,
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
