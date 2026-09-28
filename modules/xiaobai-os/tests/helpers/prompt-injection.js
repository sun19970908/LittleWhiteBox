import { createPromptInjectionCapabilityRegistration } from '../../capabilities/prompt-injection/index.ts';
import { PROMPT_INJECTION_POLICY } from '../../host/prompt-injection-policy.ts';

// Headless compositions use the real registry without native browser I/O.
export function headlessPromptInjection() {
    return createPromptInjectionCapabilityRegistration(PROMPT_INJECTION_POLICY, () => ({ publish() {}, start() {}, stop() {} }));
}
