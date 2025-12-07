
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { buildVapiPrompt, AccountData } from "./template-builder.ts";

Deno.test("buildVapiPrompt replaces variables correctly", async () => {
    const data: AccountData = {
        company_name: "Acme Plumbing",
        trade: "plumbing",
        service_area: "Metro City",
        service_specialties: "Leaks, Clogs",
        business_hours: "Mon-Fri 9am-5pm",
        call_recording_enabled: false
    };

    const prompt = await buildVapiPrompt(data);

    assertStringIncludes(prompt, "You are the phone assistant for Acme Plumbing");
    assertStringIncludes(prompt, "serving Metro City");
    assertStringIncludes(prompt, "Acme Plumbing provides Leaks, Clogs");
    assertStringIncludes(prompt, "Mon-Fri 9am-5pm");
});

Deno.test("buildVapiPrompt includes trade specific module", async () => {
    const data: AccountData = {
        company_name: "Acme Plumbing",
        trade: "plumbing",
        service_area: "Metro City"
    };

    const prompt = await buildVapiPrompt(data);
    assertStringIncludes(prompt, "Common Issues: leaks, clogs, water heaters");
});

Deno.test("buildVapiPrompt handles default why_choose_us_blurb", async () => {
    const data: AccountData = {
        company_name: "Acme Plumbing",
        trade: "plumbing",
        service_area: "Metro City"
    };

    const prompt = await buildVapiPrompt(data);
    assertStringIncludes(prompt, "committed to quality craftsmanship, honesty");
});

Deno.test("buildVapiPrompt injects customization why_choose_us_blurb", async () => {
    const data: AccountData = {
        company_name: "Acme Plumbing",
        trade: "plumbing",
        service_area: "Metro City",
        why_choose_us_blurb: "Because we are the best!"
    };

    const prompt = await buildVapiPrompt(data);
    assertStringIncludes(prompt, "Because we are the best!");
});

Deno.test("buildVapiPrompt includes recording notice when required", async () => {
    const data: AccountData = {
        company_name: "Acme Plumbing",
        trade: "plumbing",
        service_area: "Metro City",
        call_recording_enabled: true
    };

    const law = {
        consent_type: "one-party",
        notification_text: "This call is being recorded for quality assurance."
    };

    const prompt = await buildVapiPrompt(data, law);
    assertStringIncludes(prompt, 'RECORDING NOTICE (Say at call start): "This call is being recorded for quality assurance."');
});

Deno.test("buildVapiPrompt handles missing optional fields gracefully", async () => {
    const data: AccountData = {
        company_name: "Generic Co",
        trade: "general_contractor",
        service_area: ""
    };

    const prompt = await buildVapiPrompt(data);
    assertStringIncludes(prompt, "serving your local area"); // Default for service_area
});
