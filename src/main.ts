import { DateTime } from "luxon";
import pino from "pino";
import OpenAI from "openai";

import { promisify } from "util";
import { exec } from "child_process";
const execPromise = promisify(exec);

import {
  addLog,
  CommonPromptSet,
  fetchActiveMessages,
  fetchActiveRecipients,
  fetchAuthors,
  fetchCommonPrompts,
  MessageRow,
  RecipientRow,
  updateRecipient,
} from "./sheet";
import { sendSms } from "./sms";

const logger = pino();

const { LOOPS, HOT_SEND, HOT_UPDATE } = process.env;

export default async function main() {
  const openAi = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  //   await updateRecipient(1, 1, "test message", "hallo Alex");
  logger.info("Preparing sendout");
  const now = DateTime.now();
  const hotSend = HOT_SEND === "true";
  const hotUpdate = HOT_UPDATE === "true";

  const prompts = await fetchCommonPrompts();
  const recipients = await fetchActiveRecipients();
  const messages = await fetchActiveMessages();
  const authors = await fetchAuthors();
  logger.info(
    `Fetched ${recipients.length} recipients and ${messages.length} messages`
  );
  for (let i = 0; i < parseInt(process.env.LOOPS || "1"); i++)
    for (const recipient of recipients) {
      const sendable = messages.find(
        (m) => /*m.sendAfter >= now &&*/ m.wave > recipient.lastWave
      );
      if (!sendable) {
        logger.info(
          `Nothing to send to ${recipient.name} (${recipient.number})`
        );
        continue;
      }
      const content = wrapWithAuthor(
        await renderMessageContent(sendable, recipient, prompts, openAi),
        sendable,
        authors
      );

      logger.info(
        `${hotSend ? "Sending" : "NOT sending"} message ${sendable.handle} to ${
          recipient.number
        } (${recipient.language}) via ${recipient.messenger}`
      );
      if (hotSend) {
        await send(recipient, content);
      }
      if (hotUpdate) {
        logger.info(
          `Updating ${recipient.rowIndex} (${
            recipient.number
          }) to ${now.toISO()} with ${sendable.handle}`
        );

        await updateRecipient(
          recipient.rowIndex,
          sendable.wave,
          sendable.handle,
          content
        );
        recipient.lastWave = sendable.wave;

        await addLog(
          recipient.name,
          recipient.number,
          now,
          sendable.handle,
          content
        );
      }
    }
}

const send = async (recipient: RecipientRow, content: string) => {
  if (recipient.messenger === "sms") {
    await sendSms(recipient.number, content);
    logger.info("Sent via SMS");
  } else {
    const { stdout, stderr } = await execPromise(
      `${process.env.SIGNAL_CLI} send ${
        recipient.number
      } -m "${content.replaceAll('"', "'")}"`
    );
    if (
      stderr &&
      stderr !==
        `SLF4J(I): Connected with provider of type [ch.qos.logback.classic.spi.LogbackServiceProvider]
INFO  AccountHelper - The Signal protocol expects that incoming messages are regularly received.
`
    ) {
      console.log(stderr);
      console.log("pups");
      throw new Error(stderr);
    }
    logger.info("Sent via Signal");

    //        console.log("stderr:", stderr);
  }
};

const wrapWithAuthor = (
  content: string,
  sendable: MessageRow,
  authors: string[]
) => {
  content = `🐙\n${content}`;
  if (sendable.handle === "invite") {
    return content;
  }
  return `${content}\n\n${authors[Math.floor(Math.random() * authors.length)]}`;
};

const renderMessageContent = async (
  message: MessageRow,
  recipient: RecipientRow,
  prompts: CommonPromptSet,
  openAi: OpenAI
) => {
  const timeLeft = DateTime.fromISO("2024-12-07T11:00:00").diffNow();
  const valueMap = {
    name: recipient.name,
    weeks: Math.round(timeLeft.as("weeks")).toLocaleString(),
    days: Math.round(timeLeft.as("days")).toLocaleString(),
    seconds: Math.round(timeLeft.as("seconds")).toLocaleString(),
    hours: Math.round(timeLeft.as("hours")).toLocaleString(),
  };

  let templated =
    message.type === "reminder" ? prompts.reminder : message.content;

  for (const key in valueMap) {
    templated = templated.replaceAll(`{${key}}`, valueMap[key]);
  }

  if (message.type === "template") {
    return templated;
  }

  if (recipient.language === "de") {
    templated = `You respond in German. ${templated}`;
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
    model: "gpt-4o-2024-08-06",
    // model: "gpt-3.5-turbo",
    //"gpt-4o-mini-2024-07-18",
    temperature: message.temperature,
  });

  if (!completion.choices[0].message.content) {
    logger.info(completion);
    throw new Error();
  }
  return completion.choices[0].message.content;
};
