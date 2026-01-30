export class ImpersonateResponseDto {
  token!: string;
  tenant!: { id: string; name: string };
}
