# MedRoute Firestore Security Specification

## 1. Data Invariants

1. **CuratedTariff (`/curatedTariffs/{tariffId}`)**:
   - Contains strictly public institutional tariff records (hospital name, city, state, medical service ID/name, published charge in INR, source note). Never stores user PII.
   - Public read (`get`, `list`) is permitted so Live Mode users can resolve published tariffs without signing in.
   - Document creation requires an authenticated user with `request.auth.token.email_verified == true`, valid document ID (`^[a-zA-Z0-9_\-]+$`), strict allowlisted keys, `createdByUid == request.auth.uid`, `publishedChargeInr > 0 && publishedChargeInr <= 50000000`, and server timestamps (`createdAt == request.time`, `updatedAt == request.time`).
   - Updates and deletes are restricted to the record creator (`existing().createdByUid == request.auth.uid`) or verified admin (`mail2kunaln@gmail.com`), with immutable `createdByUid` and `createdAt`, strict `affectedKeys().hasOnly(...)`, and re-validated full payload via `isValidCuratedTariff(incoming())`.

2. **JourneyComparison (`/journeyComparisons/{comparisonId}`)**:
   - Strictly private to the authenticated owner (`existing().ownerId == request.auth.uid`).
   - `allow list` explicitly checks `isSignedIn() && existing().ownerId == request.auth.uid`.
   - `create` requires verified email, `incoming().ownerId == request.auth.uid`, strict key allowlist, bounded `summaryLines` array (1–4 items, first item string <= 220 chars), and `createdAt == request.time`.
   - `delete` is restricted to `isSignedIn() && existing().ownerId == request.auth.uid`.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)

1. Unauthenticated create on `/curatedTariffs/t1`.
2. Unverified email (`email_verified: false`) create on `/curatedTariffs/t2`.
3. Identity spoofing: setting `createdByUid` to another user's UID on `/curatedTariffs/t3`.
4. Shadow field injection: adding `isVerified: true` to `/curatedTariffs/t4`.
5. Negative or zero medical charge (`publishedChargeInr: 0` or `-500`) on `/curatedTariffs/t5`.
6. Client-forged timestamp (`createdAt` != `request.time`) on `/curatedTariffs/t6`.
7. Resource poisoning: 1KB document ID or 500-char `providerName` on `/curatedTariffs/...`.
8. Unauthorized update of another user's `/curatedTariffs/{id}` document.
9. Immutable field tampering: changing `createdByUid` or `createdAt` during update.
10. Cross-user read (`get` or `list`) of `/journeyComparisons/{id}` where `ownerId != request.auth.uid`.
11. Unbounded array injection: `summaryLines` with 10 elements on `/journeyComparisons/c1`.
12. Write to any unknown collection (e.g., `/admins/attacker` or `/secret/doc`) blocked by default-deny catch-all.
