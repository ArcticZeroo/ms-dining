import { useExplainSearchMutation } from '../../../../store/queries/search-explain.ts';
import { getErrorMessage } from '../../../../util/mutation.ts';
import { SearchExplainForm, IExplainRequest } from './search-explain-form.tsx';
import { ExplainResult } from './explain-result.tsx';
import './search-explain.css';

export const SearchExplainPanel = () => {
    const explainMutation = useExplainSearchMutation();

    const onExplain = (request: IExplainRequest) => explainMutation.mutate(request);

    return (
        <div className="flex-col search-explain">
            <div className="subtitle">
                Explain why a menu item did or did not match a search query. Reuses the live search
                vector top-K, cosine distance, text-match, and menu-appearance logic. Currently covers
                menu items only.
            </div>

            <SearchExplainForm isPending={explainMutation.isPending} onExplain={onExplain}/>

            {
                explainMutation.isError && (
                    <div className="card error">
                        {getErrorMessage(explainMutation.error, 'Failed to explain search')}
                    </div>
                )
            }

            {
                explainMutation.data && <ExplainResult explanation={explainMutation.data}/>
            }
        </div>
    );
};
