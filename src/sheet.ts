import { DateTime } from "luxon";
import pino from "pino";

export type CommonPromptSet = {
  system: string;
  reminder: string;
};

export type RecipientRow = {
  rowIndex: number;
  number: string;
  name: string;
  active: boolean;
  lastWave: number;
  language: "en" | "de";
  messenger: "sms" | "signal";
};

export type MessageRow = {
  active: boolean;
  handle: string;
  content: string;
  type: "prompt" | "template" | "reminder";
  sendAfter: DateTime;
  wave: number;
  temperature: number;
};

const logger = pino();

const {
  SHEET_URL,
  SHEET_TAB_RECIPIENTS,
  SHEET_TAB_MESSAGES,
  SHEET_TAB_COMMON_PROMPTS,
  SHEET_TAB_AUTHORS,
  SHEET_TAB_LOG,
} = process.env;

export const fetchCommonPrompts = async (): Promise<CommonPromptSet> => {
  const response = await (
    await fetch(`${SHEET_URL}/tabs/${SHEET_TAB_COMMON_PROMPTS}?_format=records`)
  ).json();
  return {
    system: response.find((r) => r.name === "system").content,
    reminder: response.find((r) => r.name === "reminder").content,
  };
};
export const fetchAuthors = async (): Promise<string[]> => {
  const response = await (
    await fetch(`${SHEET_URL}/tabs/${SHEET_TAB_AUTHORS}?_format=records`)
  ).json();
  return response.map((r: any) => r.name);
};
export const fetchActiveRecipients = async (): Promise<RecipientRow[]> => {
  const response = await (
    await fetch(`${SHEET_URL}/tabs/${SHEET_TAB_RECIPIENTS}?_format=records`)
  ).json();

  return response
    .map(
      (r: any, rowIndex: number): RecipientRow => ({
        rowIndex,
        number: `+${r.number.replace(/[^\d]/g, "")}`,
        name: r.name,
        active: r.number?.length > 0 && r.active === "TRUE",
        lastWave: parseInt(r.lastWave),
        language: r.language,
        messenger: r.messenger,
      })
    )
    .filter((r: RecipientRow) => r.active);
};
export const fetchActiveMessages = async (): Promise<MessageRow[]> => {
  const response = await (
    await fetch(`${SHEET_URL}/tabs/${SHEET_TAB_MESSAGES}`)
  ).json();

  return response
    .map(
      (r: any): MessageRow => ({
        sendAfter: r.sendAfter,
        wave: parseInt(r.wave),
        active: r.wave > 0 && r.active === "TRUE",
        handle: r.handle,
        content: r.content,
        type: r.type,
        temperature: parseFloat(r.temperature),
      })
    )
    .filter((r: MessageRow) => r.active)
    .sort((a: MessageRow, b: MessageRow) => a.wave - b.wave);
};

export const updateRecipient = async (
  rowIndex: number,
  lastWave: number,
  lasthandle: string,
  lastContent: string
) => {
  logger.info(`PATCH ${SHEET_URL}/tabs/${SHEET_TAB_RECIPIENTS}/${rowIndex}`);
  const result = await (
    await fetch(`${SHEET_URL}/tabs/${SHEET_TAB_RECIPIENTS}/${rowIndex}`, {
      method: "PATCH",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lastWave,
        lasthandle,
        lastContent,
      }),
    })
  ).json();
  if (result.detail) {
    throw new Error(result.detail);
  }
};
export const addLog = async (
  name: string,
  number: string,
  timestamp: DateTime,
  handle: string,
  message: string
) => {
  logger.info(`POST ${SHEET_URL}/tabs/${SHEET_TAB_LOG}`);
  const result = await (
    await fetch(`${SHEET_URL}/tabs/${SHEET_TAB_LOG}`, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        number,
        timestamp: timestamp.toISO(),
        handle,
        message,
      }),
    })
  ).json();
  if (result.detail) {
    throw new Error(result.detail);
  }
};
