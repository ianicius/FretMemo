import { useTranslation } from 'react-i18next';
import { formatPitchClass, formatPitchClassWithEnharmonic, applyPolishNotation, type NoteDisplayMode } from '@/lib/noteNotation';

export function useNoteFormatter() {
    // Calling useTranslation subscribes this hook's host component to language changes,
    // ensuring it re-renders whenever the language changes.
    const { i18n } = useTranslation();

    const format = (note: string | number, notation?: NoteDisplayMode) => {
        return formatPitchClass(note, notation);
    };

    const formatEnharmonic = (note: string | number, notation?: NoteDisplayMode) => {
        return formatPitchClassWithEnharmonic(note, notation);
    };

    const applyPolish = (noteStr: string) => {
        if (i18n.resolvedLanguage === 'pl' || i18n.language === 'pl') {
            return applyPolishNotation(noteStr);
        }
        return noteStr;
    };

    return {
        formatPitchClass: format,
        formatPitchClassWithEnharmonic: formatEnharmonic,
        applyPolishNotation: applyPolish
    };
}
