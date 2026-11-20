// Mensaje pre-llenado del anuncio -- es el primero que le llega al bot
// cuando un paciente de verdad le da clic al anuncio de Facebook/
// Instagram (ver src/app/chat/PublicChatDemo.tsx). Se comparte aqui
// para que el chat de entrenamiento de Master (AsistenteChatDemo.tsx)
// pueda mandar exactamente el mismo mensaje en automatico al abrir,
// y asi Master vea desde el inicio lo mismo que vería un paciente real.
export const MENSAJE_INICIAL_ANUNCIO = "B3 - ¡Hola! ¿Podrían darme más información?";
