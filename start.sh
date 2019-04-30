export EDH_APP_CLIENT_ID=STG2-EDH-SELF-TEST
export DEMO_APP_SIGNATURE_CERT_PRIVATE_KEY=./ssl/STG2-EDH-SELF-TEST.pem
export EDH_SIGNATURE_CERT_PUBLIC_CERT=./ssl/stg-auth-signing-public.pem

# Myinfo Biz
export EDH_APP_CLIENT_SECRET=44d953c796cccebcec9bdc826852857ab412fbe2

export EDH_APP_REDIRECT_URL=http://localhost:3001/callback
export EDH_APP_REALM=http://localhost:3001


# SANDBOX ENVIRONMENT (no PKI digital signature)
export AUTH_LEVEL=L0
export EDH_API_ENTITY='https://sandbox.api.edh.gov.sg/gov/v1/entity-sample'

# TEST ENVIRONMENT (with PKI digital signature)
# export AUTH_LEVEL=L2
# export EDH_API_ENTITY='https://test.api.edh.gov.sg/gov/v1/entity'

npm start
