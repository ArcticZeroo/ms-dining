import { useMutation } from '@tanstack/react-query';
import { explainSearch } from '../../api/client/search-explain.ts';

export const useExplainSearchMutation = () => useMutation({
    mutationFn: explainSearch,
});
