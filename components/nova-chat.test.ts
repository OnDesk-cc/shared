// Pruebas de las piezas puras de la hoja de Nova central: `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { messageText, conversationKey } from "./nova-chat-parts.ts";

test("messageText une sólo las partes de texto", () => {
	const message = {
		id: "m1",
		role: "assistant" as const,
		parts: [
			{ type: "step-start" },
			{ type: "tool-orbit__search_tasks", toolCallId: "t", state: "output-available", input: {}, output: {} },
			{ type: "text", text: "Hay " },
			{ type: "text", text: "3 tareas." },
		],
	};
	assert.equal(messageText(message as never), "Hay 3 tareas.");
});

test("conversationKey separa producto y workspace", () => {
	assert.equal(conversationKey("orbit", "ws_1"), "nova:conversation:orbit:ws_1");
	assert.notEqual(conversationKey("orbit", "ws_1"), conversationKey("vault", "ws_1"));
});
