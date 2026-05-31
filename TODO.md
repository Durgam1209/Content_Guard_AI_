# ContentGuard AI — UI Completion Tasks

## Approved plan (Phase 1)
1. Normalize trigger/cut timestamp units in `services/geminiService.ts` so Timeline markers and seek are consistent.
2. Fix Timeline tooltip/timecode formatting consistency in `components/Timeline.tsx`.
3. Improve error surfacing in `App.tsx` so failures in frame/audio extraction and analysis show clear UI errors.
4. Verify Review Room and other tab features do not break with the updated data shapes.
5. Run `npm run lint` and `npm run dev` smoke checks.

## Next phase
6. Push changes to GitHub via a new branch `blackboxai/<timestamp>-ui-fix`.

