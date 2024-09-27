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
};

export type MessageRow = {
  active: boolean;
  caption: string;
  content: string;
  type: "prompt" | "template" | "reminder";
  sendAfter: DateTime;
  wave: number;
};

const logger = pino();

const {
  SHEET_URL,
  SHEET_TAB_RECIPIENTS,
  SHEET_TAB_MESSAGES,
  SHEET_TAB_COMMON_PROMPTS,
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
export const fetchActiveRecipients = async (): Promise<RecipientRow[]> => {
  const response = await (
    await fetch(`${SHEET_URL}/tabs/${SHEET_TAB_RECIPIENTS}?_format=records`)
  ).json();

  return response
    .map(
      (r: any, rowIndex: number): RecipientRow => ({
        rowIndex,
        number: `+${r.number}`,
        name: r.name,
        active: r.number?.length > 0 && r.active === "TRUE",
        lastWave: r.lastWave,
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
        wave: r.wave,
        active: r.wave > 0 && r.active === "TRUE",
        caption: r.caption,
        content: r.content,
        type: r.type,
      })
    )
    .filter((r: MessageRow) => r.active)
    .sort((a: MessageRow, b: MessageRow) => a.wave - b.wave);
};

export const updateRecipient = async (
  rowIndex: number,
  lastWave: number,
  lastCaption: string,
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
        lastCaption,
        lastContent,
      }),
    })
  ).json();
  if (result.detail) {
    throw new Error(result.detail);
  }
};
