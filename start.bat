@ECHO off
set EDH_APP_CLIENT_ID=STG2-EDH-SELF-TEST
set DEMO_APP_SIGNATURE_CERT_PRIVATE_KEY=./ssl/STG2-EDH-SELF-TEST.pem
set EDH_SIGNATURE_CERT_PUBLIC_CERT=./ssl/stg-auth-signing-public.pem

rem Myinfo Biz
set EDH_APP_CLIENT_SECRET=44d953c796cccebcec9bdc826852857ab412fbe2

set EDH_APP_REDIRECT_URL=http://localhost:3001/callback
set EDH_APP_REALM=http://localhost:3001


rem SANDBOX ENVIRONMENT (no PKI digital signature)
set AUTH_LEVEL=L0
set EDH_API_ENTITY=https://sandbox.api.edh.gov.sg/gov/v1/entity-sample

rem TEST ENVIRONMENT (with PKI digital signature)
rem set AUTH_LEVEL=L2
rem set EDH_API_ENTITY=https://test.api.edh.gov.sg/gov/v1/entity

npm start
