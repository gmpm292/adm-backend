🌐 Flujo completo de autenticación
=====================================================
    Iniciar flujo:
GET /auth/email/init

    Redirige a Google para autenticación

    Google redirige a tu callback:

GET /auth/email/callback?code=XYZ123

    Guarda el refresh token en DB

    Verificar estado:

GET /auth/email/status

Respuesta:
json

{
  "isConfigured": true,
  "email": "tucuenta@gmail.com",
  "expiresAt": "2025-07-10T12:00:00.000Z"
}

🌐 PRUEBAS Y MONITOREO
=====================================================
    Verificar salud del servicio:
GET http://localhost:4000/email/health


🌐 CONFIGURACIÓN COMPLETA DEL SERVICIO DE EMAIL CON OAUTH2
=====================================================

1. CONFIGURACIÓN EN GOOGLE CLOUD CONSOLE

1.1 Accede a Google Cloud Console:
    URL: https://console.cloud.google.com/

1.2 Selecciona o crea un proyecto:
    - Haz clic en el selector de proyectos (arriba a la derecha)
    - Crea un nuevo proyecto o selecciona uno existente

1.3 Habilita las APIs necesarias:
    - Navega a "APIs y Servicios" > "Biblioteca"
    - Busca y habilita:
      * "Gmail API"
      * "Google People API"

1.4 Configura la pantalla de consentimiento:
    - Ve a "APIs y Servicios" > "Pantalla de consentimiento"
    - Tipo de app: "Externo"
    - Información básica:
      * Nombre de la app: "Tu App Email Service"
      * Email de soporte: tu-email@dominio.com
    - Scopes: Añade manualmente:
      * .../auth/gmail.send
      * .../auth/userinfo.email
      * openid
    - Usuarios de prueba: Añade tu email

1.5 Crea credenciales OAuth:
    - Ve a "APIs y Servicios" > "Credenciales"
    - Haz clic en "+ CREAR CREDENCIALES" > "ID de cliente OAuth"
    - Tipo de aplicación: "Aplicación web"
    - Nombre: "Email Service Client"
    - URIs de redireccionamiento autorizados:
      * http://localhost:4000/auth/email/callback
      * http://localhost:3000/auth/email/callback (si usas frontend local)
    - Guarda los cambios

1.6 Obtén tus credenciales:
    - Client ID: 804047995273-xxxxxx.apps.googleusercontent.com
    - Client Secret: GOCSPX-xxxxxxxx