import type { SVGProps } from "react";

export function GoogleDocsIcon({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 64 88"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M58 88H6c-3.3 0-6-2.7-6-6V6c0-3.3 2.7-6 6-6h36l22 22v60c0 3.3-2.7 6-6 6z"
        fill="#3086F6"
      />
      <path d="M42 0l22 22H42V0z" fill="#0C67D6" />
      <path
        d="M50 39H14v-5h36v5zm0 7H14v5h36v-5zm-10 12H14v5h26v-5z"
        fill="#FDFFFF"
      />
    </svg>
  );
}

export function GoogleSheetsIcon({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 64 88"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M42 0l22 22-11 2-11-2-2-11z" fill="#188038" />
      <path
        d="M42 22V0H6C2.685 0 0 2.685 0 6v76c0 3.315 2.685 6 6 6h52c3.315 0 6-2.685 6-6V22z"
        fill="#34A853"
      />
      <path
        d="M12 34v29h40V34H12zm17.5 24H17v-7h12.5v7zm0-12H17v-7h12.5v7zm17.5 12H34.5v-7H47v7zm0-12H34.5v-7H47v7z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function GoogleSlidesIcon({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 64 88"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M58 88H6c-3.3 0-6-2.7-6-6V6c0-3.3 2.7-6 6-6h36l22 22v60c0 3.3-2.7 6-6 6z"
        fill="#F8BF08"
      />
      <path d="M42 0l22 22H42V0z" fill="#F59307" />
      <path
        d="M12 34.5v28h40v-28H12zm35 23H17v-18h30v18z"
        fill="#FDFFFF"
      />
    </svg>
  );
}

export function GoogleDriveIcon({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 87.3 78"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}

export function GoogleGmailIcon({ className = "w-5 h-5", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="52 42 88 66"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" fill="#4285f4" />
      <path d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" fill="#34a853" />
      <path d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" fill="#fbbc04" />
      <path d="M72 74V48l24 18 24-18v26L96 92" fill="#ea4335" />
      <path d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" fill="#c5221f" />
    </svg>
  );
}
