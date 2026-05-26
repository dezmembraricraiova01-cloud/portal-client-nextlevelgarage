export function getSeverityCopy(severity: string): string | null {
	switch (severity) {
		case 'critic':       return 'Este posibil să fie expirat.';
		case 'warning':      return 'Se apropie de expirare — verifică dacă data este corectă.';
		case 'unknown_date': return 'Nu putem interpreta încă această dată.';
		case 'missing':      return null; // handled by AlertSourceHint
		default:             return null;
	}
}
