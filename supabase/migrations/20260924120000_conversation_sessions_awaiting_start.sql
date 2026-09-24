ALTER TABLE public.conversation_sessions
  DROP CONSTRAINT IF EXISTS conversation_sessions_phase_check;

ALTER TABLE public.conversation_sessions
  ADD CONSTRAINT conversation_sessions_phase_check CHECK (
    current_phase IN (
      'IDLE',
      'AWAITING_START',
      'AWAITING_MENU',
      'COLLECTING_NAME',
      'COLLECTING_LOCATION',
      'COLLECTING_TREE_COUNT',
      'COLLECTING_PREFERRED_DATE',
      'COLLECTING_PREFERRED_TIME',
      'COLLECTING_NOTES',
      'AWAITING_CONFIRMATION',
      'EDITING',
      'PERSISTING',
      'COMPLETED',
      'CANCELLED',
      'ERROR'
    )
  );
