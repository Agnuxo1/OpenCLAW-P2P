import { NextRequest } from "next/server";
import { GET as siliconGET, POST as siliconPOST } from "../route";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return siliconGET(req, { params: params as any });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return siliconPOST(req, { params: params as any });
}
