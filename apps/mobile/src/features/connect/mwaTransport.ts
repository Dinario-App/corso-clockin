// Metro resolves .android/.ios first; TypeScript and unsupported platforms
// use the adapter that refuses a native wallet handoff.
export { mwaTransact } from "./mwaTransport.ios";
