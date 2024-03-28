import mitt from "mitt";
import { type SemErrorPayload, type SynErrorPayload } from "./types";

type Events = {
  semerror: SemErrorPayload;
  synerror: SynErrorPayload;
};

export const emitter = mitt<Events>();
