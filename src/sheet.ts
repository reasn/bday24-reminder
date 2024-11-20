import { DateTime } from "luxon";
import pino from "pino";

export type VariableSet = {
  system_prompt: string;
  slots_left: number;
  slots_confirmed: number;
  slots_not_confirmed: number;
};

export type RecipientRow = {
  rowIndex: number;
  number: string;
  slots: number | "not_confirmed";
  name: string;
  active: boolean;
  lastWave: number;
  language: "en" | "de" | "fr" | "it" | "es";
  messenger: "sms" | "signal";
  highIntensity: boolean;
};

export type MessageRow = {
  active: boolean;
  handle: string;
  content: string;
  type: "prompt" | "template";
  sendAfter: DateTime;
  wave: number;
  highPriority: boolean;
  condition: null | "slots_unknown" | "coming" | "not_coming";
};

const logger = pino();

const {
  SHEET_URL,
  SHEET_TAB_RECIPIENTS,
  SHEET_TAB_MESSAGES,
  SHEET_TAB_VARIABLES,
  SHEET_TAB_AUTHORS,
  SHEET_TAB_LOG,
} = process.env;

export const fetchCommonPrompts = async (): Promise<VariableSet> => {
  const response = await (
    await fetch(`${SHEET_URL}/tabs/${SHEET_TAB_VARIABLES}?_format=records`)
  ).json();
  return {
    system_prompt: response.find((r: any) => r.name === "system_prompt")
      .content,
    slots_left: parseInt(
      response.find((r: any) => r.name === "slots_left").content
    ),
    slots_confirmed: parseInt(
      response.find((r: any) => r.name === "slots_confirmed").content
    ),
    slots_not_confirmed: parseInt(
      response.find((r: any) => r.name === "slots_not_confirmed").content
    ),
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
        slots:
          r.slots === "not_confirmed" ? "not_confirmed" : parseInt(r.slots),
        name: r.name,
        active: r.number?.length > 0 && r.active === "TRUE",
        lastWave: parseInt(r.lastWave),
        language: r.language,
        messenger: r.messenger,
        highIntensity: r.intensity === "high",
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
        highPriority: r.priority === "high",
        condition: r.condition ? r.condition : null,
      })
    )
    .filter((r: MessageRow) => r.active)
    .sort((a: MessageRow, b: MessageRow) => a.wave - b.wave);
};

export const updateRecipient = async (
  rowIndex: number,
  lastWave: number,
  lastHandle: string,
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
        lastHandle,
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
