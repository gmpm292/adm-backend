export class AppEvent {
  notify: Array<string>;
  message: string;
}
export type ZoomEventType = {
  event: 'call_recording_stared' | 'call_recording_ended';
  data: {
    call_id: string;
    callId: number;
    begin_time?: string;
    phone?: string;
  };
};
